import { workforceRouter } from "./router/workforce";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  workforce: workforceRouter,
});

export type AppRouter = typeof appRouter;
