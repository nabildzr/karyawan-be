import Elysia from "elysia";


export const historyRoutes = new Elysia({
  prefix: "/history",
  detail: { tags: ["History"] },
})
  