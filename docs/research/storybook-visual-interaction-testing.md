# Research: Storybook 8+, Interaction Testing & Visual Regression cho Hệ Thống UI Components

**Ticket:** #12  
**Status:** Approved Architectural Specification  
**Target Module:** UI Component Catalog, Visual Regression & Interaction Testing System  
**Primary Dependencies:** `@storybook/nextjs` (v8.6+), `@storybook/react`, `@storybook/test`, `@storybook/addon-essentials`, `@storybook/addon-interactions`, `@storybook/addon-themes`, `@storybook/addon-a11y`, `@storybook/test-runner`, `chromatic`

---

## 1. Overview & Architectural Goals

The IELTS Learning Platform contains specialized, high-stakes client-side UI workflows:

1. **IELTS Writing Workspace:** Real-time word count calculation against official Cambridge band thresholds (150w / 250w), strict mock test lockdown (paste prevention, exam timers), and debounced local auto-saving.
2. **Teacher Review & Error Markup Workspace:** Interactive error highlights across 4 IELTS assessment criteria (GRA, LR, CC, TA/TR), with diagnostic popovers and one-click correction actions.
3. **Speaking Audio Recorder:** Web Audio API waveform visualization, decibel metering, audio chunk uploading, and playback scrubber.
4. **Assessment Feedback Diff Viewer:** Visual side-by-side and unified diffing between AI Assessment Proposals and approved Teacher Assessments.

Developing and testing these components in full Next.js pages causes slow feedback loops, brittle E2E tests, and difficulty reproducing edge cases (e.g., audio upload failure, paste violations, or dark-mode color contrast bugs).

### 1.1 Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            STORYBOOK 8 ISOLATION ENGINE                     │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌─────────────────┐  │
│  │ Tailwind v4 OKLCH CSS │  │ Next.js App Router    │  │ Better Auth     │  │
│  │ (app/globals.css)     │  │ Navigation Mocks      │  │ Mock Provider   │  │
│  └───────────────────────┘  └───────────────────────┘  └─────────────────┘  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Web Audio API Synthetic Mocks (getUserMedia, MediaRecorder, Analyser) │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
            ┌──────────────────────────┴──────────────────────────┐
            ▼                                                     ▼
┌──────────────────────────────────────┐  ┌───────────────────────────────────┐
│     INTERACTION TESTING ENGINE       │  │    VISUAL REGRESSION ENGINE       │
│  • `@storybook/test` (Vitest engine) │  │  • Chromatic Cloud Pipeline       │
│  • `play` functions (userEvent)      │  │  • `@storybook/test-runner`       │
│  • Word count thresholds validation  │  │  • Multi-Viewport Matrix          │
│  • Popover trigger & correction exec │  │    (375px, 768px, 1280px, 1536px) │
│  • Strict Mode Paste blocking check  │  │  • Theme Matrix (Light / Dark)    │
└──────────────────────────────────────┘  └───────────────────────────────────┘
```

---

## 2. Storybook 8+ Configuration for Next.js 16, React 19 & Tailwind CSS v4

### 2.1 Package Dependencies

```bash
bun add -d @storybook/nextjs @storybook/react @storybook/test @storybook/addon-essentials @storybook/addon-interactions @storybook/addon-themes @storybook/addon-a11y @storybook/test-runner chromatic
```

### 2.2 Storybook Configuration Files

#### 2.2.1 `.storybook/main.ts`

```typescript
import type { StorybookConfig } from "@storybook/nextjs";

const config: StorybookConfig = {
  stories: [
    "../components/**/*.mdx",
    "../components/**/*.stories.@(js|jsx|mjs|ts|tsx)",
    "../app/**/*.stories.@(js|jsx|mjs|ts|tsx)",
  ],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-themes",
    "@storybook/addon-a11y",
  ],
  framework: {
    name: "@storybook/nextjs",
    options: {
      builder: {
        useSWC: true,
      },
    },
  },
  staticDirs: ["../public"],
  docs: {
    autodocs: "tag",
  },
  typescript: {
    check: false,
    reactDocgen: "react-docgen-typescript",
    reactDocgenTypescriptOptions: {
      shouldExtractLiteralValuesFromEnum: true,
      propFilter: (prop) =>
        prop.parent ? !/node_modules/.test(prop.parent.fileName) : true,
    },
  },
};

export default config;
```

#### 2.2.2 `.storybook/preview.ts`

```typescript
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
      disable: true, // Controlled by @storybook/addon-themes to avoid background clash with OKLCH
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
```

---

## 3. Mocking Architecture for Browser APIs, Next.js & Auth

### 3.1 Better Auth Session Provider Mocking

```tsx
// .storybook/mocks/auth-context.mock.tsx
import React, { createContext, useContext } from "react";

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: "learner" | "teacher" | "admin";
  avatarUrl?: string;
}

interface AuthContextType {
  user: MockUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAuthenticated: false,
  isLoading: false,
});

export const useMockAuth = () => useContext(AuthContext);

export const MockAuthProvider = ({
  user,
  children,
}: {
  user: MockUser | null;
  children: React.ReactNode;
}) => {
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const withMockAuth = (user: MockUser | null) => {
  const AuthDecorator = (Story: React.ComponentType) => (
    <MockAuthProvider user={user}>
      <Story />
    </MockAuthProvider>
  );
  AuthDecorator.displayName = "WithMockAuth";
  return AuthDecorator;
};

export const MOCK_LEARNER_USER: MockUser = {
  id: "usr-learner-001",
  name: "Tran Minh Anh",
  email: "learner@ielts-prep.vn",
  role: "learner",
  avatarUrl:
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
};

export const MOCK_TEACHER_USER: MockUser = {
  id: "usr-teacher-001",
  name: "Mr. David Harrison (IELTS 8.5)",
  email: "david.harrison@ielts-prep.vn",
  role: "teacher",
  avatarUrl:
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100",
};
```

### 3.2 Audio Web API Mocking for Isolated Storybook Rendering

```typescript
// .storybook/mocks/audio-api.mock.ts

/**
 * Initializes synthetic Web Audio & MediaRecorder APIs in the Storybook window.
 */
export function setupAudioApiMocks() {
  if (typeof window === "undefined") return;

  // 1. Mock MediaStream & MediaStreamTrack
  class MockMediaStreamTrack {
    kind = "audio";
    enabled = true;
    readyState = "live";
    stop = () => {
      this.readyState = "ended";
    };
  }

  class MockMediaStream {
    active = true;
    private tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()];
    getTracks() {
      return this.tracks;
    }
    getAudioTracks() {
      return this.tracks;
    }
  }

  // 2. Mock getUserMedia
  if (!navigator.mediaDevices) {
    // @ts-expect-error Mocking readonly property
    navigator.mediaDevices = {};
  }
  navigator.mediaDevices.getUserMedia = async (_constraints) => {
    return new MockMediaStream() as unknown as MediaStream;
  };

  // 3. Mock MediaRecorder
  class MockMediaRecorder extends EventTarget {
    state: "inactive" | "recording" | "paused" = "inactive";
    mimeType: string;
    private intervalId: ReturnType<typeof setInterval> | null = null;

    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onstop: ((event: Event) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    static isTypeSupported(type: string) {
      return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].includes(
        type
      );
    }

    constructor(_stream: MediaStream, options?: { mimeType?: string }) {
      super();
      this.mimeType = options?.mimeType || "audio/webm;codecs=opus";
    }

    start(timeslice?: number) {
      this.state = "recording";
      const interval = timeslice || 1000;
      this.intervalId = setInterval(() => {
        if (this.state === "recording" && this.ondataavailable) {
          const dummyChunk = new Blob(["mock-audio-bytes"], {
            type: this.mimeType,
          });
          // @ts-expect-error Synthetic event
          this.ondataavailable({ data: dummyChunk } as BlobEvent);
        }
      }, interval);
    }

    stop() {
      this.state = "inactive";
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      if (this.onstop) {
        this.onstop(new Event("stop"));
      }
    }

    pause() {
      this.state = "paused";
    }

    resume() {
      this.state = "recording";
    }
  }

  // @ts-expect-error Global mock injection
  window.MediaRecorder = MockMediaRecorder;

  // 4. Mock AudioContext & AnalyserNode for Live Waveform Rendering
  class MockAnalyserNode {
    fftSize = 256;
    frequencyBinCount = 128;
    smoothingTimeConstant = 0.8;

    getByteFrequencyData(array: Uint8Array) {
      const now = Date.now() / 200;
      for (let i = 0; i < array.length; i++) {
        const val =
          Math.sin(now + i * 0.15) * 60 +
          Math.cos(now * 0.5 + i * 0.05) * 40 +
          120;
        array[i] = Math.max(10, Math.min(255, Math.floor(val)));
      }
    }

    getByteTimeDomainData(array: Uint8Array) {
      for (let i = 0; i < array.length; i++) {
        array[i] = 128 + Math.sin(i * 0.1) * 30;
      }
    }
  }

  class MockAudioContext {
    state = "running";
    createAnalyser() {
      return new MockAnalyserNode();
    }
    createMediaStreamSource(_stream: MediaStream) {
      return {
        connect: (_node: unknown) => {},
        disconnect: () => {},
      };
    }
    close() {
      this.state = "closed";
      return Promise.resolve();
    }
  }

  // @ts-expect-error Global mock injection
  window.AudioContext = MockAudioContext;
  // @ts-expect-error Webkit compatibility mock
  window.webkitAudioContext = MockAudioContext;
}
```

---

## 4. Component Catalog & Story Architecture

### 4.1 `IeltsWritingEditor.stories.tsx`

```tsx
import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "@storybook/test";
import React, { useState } from "react";
import {
  withMockAuth,
  MOCK_LEARNER_USER,
} from "../../.storybook/mocks/auth-context.mock";

export interface IeltsWritingEditorProps {
  taskType: "TASK_1_ACADEMIC" | "TASK_1_GENERAL" | "TASK_2";
  promptTitle: string;
  promptDescription: string;
  initialContent?: string;
  isMockTestMode?: boolean;
  timeLimitSeconds?: number;
}

export const IeltsWritingEditor = ({
  taskType,
  promptTitle,
  promptDescription,
  initialContent = "",
  isMockTestMode = false,
}: IeltsWritingEditorProps) => {
  const [text, setText] = useState(initialContent);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "saved"
  );
  const [pasteBlockedToast, setPasteBlockedToast] = useState(false);

  const minWords = taskType === "TASK_2" ? 250 : 150;
  const optimalRange = taskType === "TASK_2" ? [260, 320] : [160, 200];
  const wordsCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  const isUnderlength = wordsCount < minWords;
  const isOptimal =
    wordsCount >= optimalRange[0] && wordsCount <= optimalRange[1];

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    setSaveStatus("saving");
    setTimeout(() => setSaveStatus("saved"), 600);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (isMockTestMode) {
      e.preventDefault();
      setPasteBlockedToast(true);
      setTimeout(() => setPasteBlockedToast(false), 3000);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto border rounded-xl bg-card text-card-foreground shadow-sm overflow-hidden">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/40">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-primary">
            {taskType.replace(/_/g, " ")}
          </span>
          <h2 className="text-lg font-bold mt-0.5">{promptTitle}</h2>
        </div>
        <div className="flex items-center gap-3">
          {isMockTestMode && (
            <span
              data-testid="mock-test-badge"
              className="px-2.5 py-1 text-xs font-semibold rounded-full bg-destructive/15 text-destructive border border-destructive/30"
            >
              Strict Exam Mode
            </span>
          )}
          <span
            data-testid="autosave-status"
            className="text-xs text-muted-foreground"
          >
            {saveStatus === "saving" ? "Saving draft..." : "Saved to cloud"}
          </span>
        </div>
      </div>

      {/* Prompt Instructions */}
      <div className="p-6 bg-muted/20 border-b text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
        {promptDescription}
      </div>

      {/* Editor Body */}
      <div className="p-6 relative">
        <textarea
          data-testid="writing-textarea"
          value={text}
          onChange={handleTextChange}
          onPaste={handlePaste}
          placeholder="Type your IELTS response here..."
          className="w-full min-h-[320px] p-4 text-base leading-relaxed bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 resize-y font-sans"
        />

        {pasteBlockedToast && (
          <div
            data-testid="paste-blocked-toast"
            role="alert"
            className="absolute bottom-10 left-10 right-10 p-3 bg-destructive text-destructive-foreground rounded-lg shadow-lg text-sm font-medium flex items-center justify-between transition-all"
          >
            <span>
              Pasting external text is prohibited in Strict Mock Test Mode.
            </span>
          </div>
        )}
      </div>

      {/* Footer / Counter Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Word Count:</span>
          <span
            data-testid="word-count-badge"
            className={`px-2.5 py-0.5 text-xs font-bold rounded-md transition-colors ${
              isUnderlength
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                : isOptimal
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                  : "bg-primary/10 text-primary border border-primary/20"
            }`}
          >
            {wordsCount} / {minWords} words minimum
          </span>
        </div>
        <button
          type="button"
          data-testid="submit-essay-btn"
          className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Submit for Assessment
        </button>
      </div>
    </div>
  );
};

const meta: Meta<typeof IeltsWritingEditor> = {
  title: "IELTS/Writing/IeltsWritingEditor",
  component: IeltsWritingEditor,
  decorators: [withMockAuth(MOCK_LEARNER_USER)],
  parameters: {
    layout: "padded",
  },
};

export default meta;
type Story = StoryObj<typeof IeltsWritingEditor>;

export const Task1AcademicUnderlength: Story = {
  args: {
    taskType: "TASK_1_ACADEMIC",
    promptTitle: "Task 1: Renewable Energy Production (2010 - 2025)",
    promptDescription:
      "The chart below shows the proportion of energy produced from renewable sources in four European countries between 2010 and 2025.\n\nSummarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    initialContent:
      "The line graph compares the percentage of renewable electricity.",
    isMockTestMode: false,
  },
};

export const Task2OptimalLength: Story = {
  args: {
    taskType: "TASK_2",
    promptTitle: "Task 2: Remote Work & Urban Congestion",
    promptDescription:
      "Some people argue that working from home benefits society by reducing traffic congestion and pollution, while others believe it harms team collaboration.\n\nDiscuss both views and give your own opinion.",
    initialContent:
      "In recent years, the transition towards telecommuting has sparked considerable debate. On the one hand, proponents argue that remote working substantially alleviates traffic congestion in metropolitan areas, thereby curtailing carbon emissions and commuter stress. On the other hand, skeptics maintain that face-to-face interaction is indispensable for fostering creative synergy and corporate culture. In my opinion, while organizational communication requires intentional structure in virtual environments, the socioeconomic and ecological advantages of flexible working far outweigh the drawbacks.\n\nTo begin with, the reduction of daily commuters directly diminishes rush-hour gridlock and air pollutants.",
    isMockTestMode: false,
  },
};

export const StrictMockTestMode: Story = {
  args: {
    taskType: "TASK_2",
    promptTitle: "Task 2: AI in Higher Education (Mock Exam)",
    promptDescription:
      "Write at least 250 words. You have 40 minutes under official timed exam conditions. Pasting and external assistance are disabled.",
    initialContent: "",
    isMockTestMode: true,
  },
};

// Interaction Test: Reactive Word Count Thresholds
export const ReactiveWordCountTest: Story = {
  args: {
    taskType: "TASK_1_ACADEMIC",
    promptTitle: "Interactive Word Counter Verification",
    promptDescription: "Test typing reactivity and badge status transition.",
    initialContent: "",
    isMockTestMode: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByTestId("writing-textarea");
    const badge = canvas.getByTestId("word-count-badge");

    // 1. Initial State: 0 words (Underlength)
    await expect(badge).toHaveTextContent("0 / 150 words minimum");

    // 2. Type 10 words
    await userEvent.type(
      textarea,
      "The provided bar chart depicts industrial water consumption in Australia."
    );
    await expect(badge).toHaveTextContent("10 / 150 words minimum");
  },
};

// Interaction Test: Paste Prevention in Strict Mode
export const PastePreventionTest: Story = {
  args: {
    taskType: "TASK_2",
    promptTitle: "Strict Paste Blocking Verification",
    promptDescription:
      "Verify that user paste events are blocked with alert banner.",
    initialContent: "Original essay opening. ",
    isMockTestMode: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const textarea = canvas.getByTestId("writing-textarea");

    // Trigger paste event
    await userEvent.paste(textarea, "Pasted cheat text from internet.");

    // Assert that the warning toast appears
    const toast = await canvas.findByTestId("paste-blocked-toast");
    await expect(toast).toBeInTheDocument();
    await expect(toast).toHaveTextContent(
      "Pasting external text is prohibited"
    );

    // Assert that textarea text was not modified
    await expect(textarea).toHaveValue("Original essay opening. ");
  },
};
```

---

## 5. Visual Regression Testing & Multi-Viewport Matrix

### 5.1 Multi-Viewport & Dark Mode Automation

Visual regressions are tested across 4 standard viewports in both Light and Dark modes:

| Viewport Target  | Dimensions   | Target Device    | Key Validation Elements                                                   |
| :--------------- | :----------- | :--------------- | :------------------------------------------------------------------------ |
| **Mobile**       | `375 x 667`  | iPhone SE        | Touch targets ($44\text{px}+$ min), no horizontal overflow in diff viewer |
| **Mobile Large** | `390 x 844`  | iPhone 14/15     | Stacked layout for prompt description and word badge                      |
| **Tablet**       | `768 x 1024` | iPad             | 2-column grid adaptation for teacher calibration rationale                |
| **Desktop**      | `1280 x 800` | MacBook / Laptop | Full side-by-side diff viewer and floating error popover alignment        |

### 5.2 Playwright Test Runner Configuration (`.storybook/test-runner.ts`)

```typescript
import { type TestRunnerConfig } from "@storybook/test-runner";
import { injectAxe, checkA11y } from "axe-playwright";

const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page, context) {
    await checkA11y(page, "#storybook-root", {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
      axeOptions: {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa"],
        },
      },
    });
  },
};

export default config;
```

---

## 6. Tổng Kết

1. **Component Sandbox Độc lập:** Toàn bộ các component phức tạp (`IeltsWritingEditor`, `TeacherReviewAnnotator`, `SpeakingAudioRecorder`, `FeedbackDiffViewer`) có thể được phát triển và kiểm thử giao diện độc lập mà không phụ thuộc vào backend database hay API thật.
2. **Interaction Testing:** Sử dụng `play` function tự động hóa kiểm tra tính phản ứng (reactive word count, mở popover lỗi, áp dụng sửa lỗi, chặn paste trong chế độ thi).
3. **Visual Regression:** Kiểm soát chất lượng UI đa thiết bị (Mobile, Tablet, Desktop) và giao diện Sáng / Tối (Light/Dark mode) qua Chromatic hoặc Playwright Test Runner.
