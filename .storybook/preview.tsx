import React, { useEffect } from "react";
import type { Preview } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";
import { Inter, Geist, Geist_Mono } from "next/font/google";
import "../app/globals.css";
import { setupAudioApiMocks } from "./mocks/audio-api.mock";

setupAudioApiMocks();

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const customViewports = {
  mobileSmall: {
    name: "Mobile Small (iPhone SE)",
    styles: { width: "375px", height: "667px" },
  },
  mobileStandard: {
    name: "Mobile Standard (iPhone 14/15)",
    styles: { width: "390px", height: "844px" },
  },
  tablet: {
    name: "Tablet (iPad Mini/Air)",
    styles: { width: "768px", height: "1024px" },
  },
  desktop: {
    name: 'Desktop (Laptop 13")',
    styles: { width: "1280px", height: "800px" },
  },
  desktopLarge: {
    name: "Desktop Large (1080p)",
    styles: { width: "1536px", height: "864px" },
  },
};

const preview: Preview = {
  initialGlobals: {
    viewport: "desktop",
    theme: "light",
  },
  parameters: {
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: "/ielts/writing/practice",
        query: { mode: "homework" },
      },
    },
    viewport: {
      viewports: customViewports,
    },
    backgrounds: {
      disable: true,
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: "todo",
    },
  },
  decorators: [
    withThemeByClassName({
      themes: {
        light: "",
        dark: "dark",
      },
      defaultTheme: "light",
    }),
    (Story) => {
      useEffect(() => {
        if (typeof document !== "undefined") {
          document.documentElement.classList.add(
            inter.variable,
            geistSans.variable,
            geistMono.variable,
            "font-sans"
          );
          document.body.classList.add(
            inter.variable,
            geistSans.variable,
            geistMono.variable,
            "font-sans"
          );
        }
      }, []);

      return (
        <div
          className={`${inter.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
        >
          <Story />
        </div>
      );
    },
  ],
};

export default preview;
