import { onRequestPost as __api_chat_js_onRequestPost } from "C:\\Users\\grd_a\\.gemini\\antigravity\\scratch\\Veta_Vigor_App\\functions\\api\\chat.js"
import { onRequest as __api_chat_js_onRequest } from "C:\\Users\\grd_a\\.gemini\\antigravity\\scratch\\Veta_Vigor_App\\functions\\api\\chat.js"

export const routes = [
    {
      routePath: "/api/chat",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_chat_js_onRequestPost],
    },
  {
      routePath: "/api/chat",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api_chat_js_onRequest],
    },
  ]