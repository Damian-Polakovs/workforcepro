import { authRouter } from "./router/auth";
import { workforceRouter } from "./router/workforce";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  workforce: workforceRouter,
});

export type AppRouter = typeof appRouter;
