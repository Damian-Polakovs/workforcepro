import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { trpc } from "~/utils/api";

type ScanMode = "clockIn" | "clockOut" | "enroll";
const maxFaceImageBase64Length = 12_000_000;
const cameraDeviceLabel = "WorkForcePro front camera scanner";

const resolveMode = (mode: string | string[] | undefined): ScanMode => {
  const value = Array.isArray(mode) ? mode[0] : mode;

  if (value === "clockIn" || value === "clockOut") {
    return value;
  }

  return "enroll";
};

const buildFrameSignature = (props: {
  capturedAt: string;
  height?: number;
  mode: ScanMode;
  uri?: string;
  width?: number;
}) => {
  const uriTail = props.uri?.split(/[\\/]/).pop()?.slice(-64) ?? "camera-frame";

  return [
    props.mode,
    props.capturedAt,
    uriTail,
    props.width ?? 0,
    props.height ?? 0,
    Date.now(),
  ].join(":");
};

const createFaceScan = (props: {
  deviceLabel?: string;
  imageBase64: string;
  height?: number;
  mode: ScanMode;
  uri?: string;
  width?: number;
}) => {
  const capturedAt = new Date().toISOString();

  return {
    capturedAt,
    deviceLabel: props.deviceLabel ?? cameraDeviceLabel,
    frameSignature: buildFrameSignature({
      capturedAt,
      height: props.height,
      mode: props.mode,
      uri: props.uri,
      width: props.width,
    }),
    imageBase64: props.imageBase64,
  };
};

const parsePictureSize = (value: string) => {
  const match = value.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);

  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return null;
  }

  return {
    area: width * height,
    height,
    value,
    width,
  };
};

const selectFacePictureSize = (sizes: string[]) => {
  const parsed = sizes
    .map(parsePictureSize)
    .filter((size): size is NonNullable<typeof size> => Boolean(size))
    .sort((left, right) => left.area - right.area);

  return (
    parsed.find((size) => Math.max(size.width, size.height) >= 640)?.value ??
    parsed[0]?.value
  );
};

export default function FaceScanScreen() {
  const params = useLocalSearchParams<{
    mode?: string;
    required?: string;
  }>();
  const mode = useMemo(() => resolveMode(params.mode), [params.mode]);
  const router = useRouter();
  const queryClient = useQueryClient();
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>();
  const [progress, setProgress] = useState(0);
  const [scanState, setScanState] = useState<"scanning" | "success" | "error">(
    "scanning",
  );
  const [message, setMessage] = useState("Opening secure face scanner...");
  const [submitted, setSubmitted] = useState(false);

  const enrollMutation = useMutation(
    trpc.workforce.enrollFace.mutationOptions(),
  );
  const clockInMutation = useMutation(trpc.workforce.clockIn.mutationOptions());
  const clockOutMutation = useMutation(
    trpc.workforce.clockOut.mutationOptions(),
  );

  const title =
    mode === "enroll"
      ? "Create first face scan"
      : mode === "clockIn"
        ? "Clock-in face scan"
        : "Clock-out face scan";

  const successCopy =
    mode === "enroll"
      ? "Face scan stored. Returning to your workspace..."
      : mode === "clockIn"
        ? "Face match passed. Starting your shift timer..."
        : "Face match passed. Closing your shift...";

  const handleCameraReady = useCallback(() => {
    setCameraReady(true);

    void cameraRef.current
      ?.getAvailablePictureSizesAsync()
      .then((sizes) => {
        const selected = selectFacePictureSize(sizes);
        if (selected) {
          setPictureSize(selected);
        }
      })
      .catch(() => {
        setPictureSize(undefined);
      });
  }, []);

  const submitScan = async () => {
    if (submitted) {
      return;
    }

    setSubmitted(true);
    setMessage("Capturing face and verifying identity...");

    if (!permission?.granted || !cameraReady || !cameraRef.current) {
      setSubmitted(false);
      setScanState("error");
      setMessage("Camera is not ready yet. Please grant access and try again.");
      return;
    }

    try {
      const faceScan = await captureCameraFaceScan(mode, cameraRef.current);

      if (mode === "enroll") {
        await enrollMutation.mutateAsync({
          consentAccepted: true,
          faceScan,
        });
      } else if (mode === "clockIn") {
        await clockInMutation.mutateAsync({
          faceScan,
          note: "Clock-in submitted after secure face scan.",
        });
      } else {
        await clockOutMutation.mutateAsync({
          faceScan,
          note: "Clock-out submitted after secure face scan.",
        });
      }

      setProgress(100);
      setScanState("success");
      setMessage(successCopy);

      await Promise.all([
        queryClient.invalidateQueries(trpc.workforce.dashboard.queryFilter()),
        queryClient.invalidateQueries(
          trpc.workforce.payrollPreview.queryFilter(),
        ),
      ]);

      setTimeout(() => {
        router.replace("/dashboard");
      }, 700);
    } catch (error) {
      setSubmitted(false);
      setScanState("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Face scan could not be completed. Please try again.",
      );
    }
  };

  useEffect(() => {
    setProgress(0);
    setScanState("scanning");
    setMessage(
      params.required === "1"
        ? "First login requires a face scan before clocking actions are enabled."
        : "Opening secure face scanner...",
    );
    setSubmitted(false);
  }, [mode, params.required]);

  useEffect(() => {
    if (!permission?.granted || !cameraReady || scanState !== "scanning") {
      return;
    }

    const progressTimer = setInterval(() => {
      setProgress((value) => Math.min(value + 4, 96));
    }, 90);
    const scanTimer = setTimeout(() => {
      void submitScan();
    }, 2400);

    return () => {
      clearInterval(progressTimer);
      clearTimeout(scanTimer);
    };
  }, [cameraReady, mode, params.required, permission?.granted, scanState]);

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-[#071522]">
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <ActivityIndicator color="#94d2bd" size="large" />
          <Text className="text-center text-base text-white/80">
            Preparing secure camera permissions...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-[#071522]">
        <View className="flex-1 justify-center px-6">
          <View className="rounded-[32px] border border-white/12 bg-[#0e2435] p-6">
            <Text className="text-xs font-semibold tracking-[3px] text-[#94d2bd] uppercase">
              WorkForcePro biometric gate
            </Text>
            <Text className="mt-5 text-3xl leading-10 font-semibold text-white">
              Camera access required
            </Text>
            <Text className="mt-3 text-base leading-7 text-[#b7cad6]">
              Employees need to allow the front camera so WorkForcePro can
              capture the first face scan and verify future clock actions.
            </Text>
            <Pressable
              className="mt-6 rounded-2xl bg-[#ff764a] px-4 py-4"
              onPress={() => void requestPermission()}
            >
              <Text className="text-center text-sm font-semibold text-white">
                Allow camera access
              </Text>
            </Pressable>
            <Pressable
              className="mt-3 rounded-2xl border border-white/15 px-4 py-4"
              onPress={() => router.replace("/dashboard")}
            >
              <Text className="text-center text-sm font-semibold text-white">
                Back to dashboard
              </Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#071522]">
      <View className="flex-1 px-6 py-8">
        <View className="flex-row items-center justify-between">
          <Text className="text-xs font-semibold tracking-[3px] text-[#94d2bd] uppercase">
            WorkForcePro biometric gate
          </Text>
          <Pressable
            className="rounded-full border border-white/15 px-4 py-2"
            onPress={() => router.replace("/dashboard")}
          >
            <Text className="text-xs font-semibold tracking-[2px] text-white uppercase">
              Cancel
            </Text>
          </Pressable>
        </View>

        <View className="mt-10 rounded-[32px] border border-white/12 bg-[#0e2435] p-6">
          <Text className="text-3xl leading-10 font-semibold text-white">
            {title}
          </Text>
          <Text className="mt-3 text-base leading-7 text-[#b7cad6]">
            {message}
          </Text>

          <View className="mt-8 items-center">
            <View className="h-72 w-72 overflow-hidden rounded-full border-2 border-[#94d2bd]/70 bg-[#102d42]">
              <CameraView
                ref={cameraRef}
                facing="front"
                mode="picture"
                onCameraReady={handleCameraReady}
                onMountError={() => {
                  setScanState("error");
                  setMessage("Camera could not be opened. Please try again.");
                }}
                pictureSize={pictureSize}
                style={StyleSheet.absoluteFill}
              />
              <View className="absolute inset-0 items-center justify-center bg-[#071522]/20">
                <View className="h-52 w-52 items-center justify-center rounded-full border border-white/60">
                  {scanState === "success" ? (
                    <Text className="text-6xl font-semibold text-[#94d2bd]">
                      OK
                    </Text>
                  ) : scanState === "error" ? (
                    <Text className="text-6xl font-semibold text-[#ff764a]">
                      !
                    </Text>
                  ) : (
                    <ActivityIndicator color="#94d2bd" size="large" />
                  )}
                </View>
              </View>
            </View>
          </View>

          <View className="mt-8 h-3 overflow-hidden rounded-full bg-white/10">
            <View
              className={`h-3 rounded-full ${
                scanState === "error" ? "bg-[#ff764a]" : "bg-[#94d2bd]"
              }`}
              style={{ width: `${progress}%` }}
            />
          </View>

          <Text className="mt-3 text-right text-xs font-semibold tracking-[2px] text-[#94d2bd] uppercase">
            {progress}% verified
          </Text>
        </View>

        {scanState === "error" ? (
          <View className="mt-5 flex-row gap-3">
            <Pressable
              className="flex-1 rounded-2xl border border-white/15 px-4 py-4"
              onPress={() => router.replace("/dashboard")}
            >
              <Text className="text-center text-sm font-semibold text-white">
                Back
              </Text>
            </Pressable>
            <Pressable
              className="flex-1 rounded-2xl bg-[#ff764a] px-4 py-4"
              onPress={() => void submitScan()}
            >
              <Text className="text-center text-sm font-semibold text-white">
                Retry scan
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

async function captureCameraFaceScan(
  mode: ScanMode,
  camera: CameraView | null,
) {
  if (!camera) {
    throw new Error("Camera is not ready yet. Please try again.");
  }

  const photo = await camera.takePictureAsync({
    base64: true,
    imageType: "jpg",
    quality: 0.22,
    skipProcessing: false,
  });

  if (!photo?.base64) {
    throw new Error(
      "Camera capture did not include image data for face verification.",
    );
  }

  if (photo.base64.length > maxFaceImageBase64Length) {
    throw new Error(
      "Camera capture was too large for face verification. Move closer to the camera and retry.",
    );
  }

  return createFaceScan({
    height: photo.height,
    imageBase64: photo.base64,
    mode,
    uri: photo.uri,
    width: photo.width,
  });
}
