import { component$ } from "@builder.io/qwik";
import { QwikCityProvider, RouterOutlet, ServiceWorkerRegister } from "@builder.io/qwik-city";
import { RouterHead } from "./components/router-head";
import { ThemeProvider } from "./stores/theme-store";
import { AuthProvider } from "./stores/auth-store";
import { QuestionProvider } from "./stores/question-store";
import "./styles/global.css";

export default component$(() => {
  return (
    <QwikCityProvider>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="manifest" href="/manifest.json" />
        <script
          dangerouslySetInnerHTML={`try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}else{document.documentElement.style.colorScheme="light"}}catch(e){}`}
        />
        <RouterHead />
      </head>
      <body lang="en" class="min-h-screen bg-surface text-text-primary antialiased">
        <ThemeProvider>
          <AuthProvider>
            <QuestionProvider>
              <RouterOutlet />
            </QuestionProvider>
          </AuthProvider>
        </ThemeProvider>
        <ServiceWorkerRegister />
      </body>
    </QwikCityProvider>
  );
});
