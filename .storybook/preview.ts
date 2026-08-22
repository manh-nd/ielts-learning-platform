import type { Preview } from "@storybook/react";
import { withThemeByClassName } from "@storybook/addon-themes";
import "../app/globals.css";

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
      defaultViewport: "desktop",
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
  ],
};

export default preview;
