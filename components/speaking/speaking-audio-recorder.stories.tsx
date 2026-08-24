import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { SpeakingAudioRecorder } from "./speaking-audio-recorder";
import {
  resetAudioMocks,
  mockPermissionDenied,
  mockDeviceNotFound,
  restoreNativeAudioApis,
} from "../../.storybook/mocks/audio-api.mock";

const meta: Meta<typeof SpeakingAudioRecorder> = {
  title: "IELTS/Speaking/SpeakingAudioRecorder",
  component: SpeakingAudioRecorder,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  beforeEach: () => {
    resetAudioMocks();
  },
};

export default meta;
type Story = StoryObj<typeof SpeakingAudioRecorder>;

/**
 * 1. Default idle state awaiting student to start recording
 */
export const IdleDefault: Story = {
  args: {
    title: "IELTS Speaking Part 1 - Work & Studies (Sandbox Mock)",
    description: "What do you enjoy most about your current job or study area?",
    maxDurationSeconds: 60,
  },
};

/**
 * 2. Real Microphone Hardware Mode (Thu âm bằng Micro thật)
 * Cho phép bạn cấp quyền micro thật trên trình duyệt, thu âm giọng nói thực tế và nghe lại.
 */
export const LiveRealMicrophone: Story = {
  name: "Live Real Microphone (Microphone Thật)",
  args: {
    title: "IELTS Speaking Part 2 - Thu Âm Micro Thực Tế",
    description:
      "Nói vào micro thật của máy tính. Nhấn nút Micro và chọn 'Cho phép' (Allow) để bắt đầu ghi âm thực tế.",
    maxDurationSeconds: 120,
  },
  beforeEach: () => {
    restoreNativeAudioApis();
  },
};

/**
 * 2. Playback and review state with recorded sample audio
 */
export const PlaybackReview: Story = {
  args: {
    title: "IELTS Speaking Part 1 - Hometown Response",
    description: "Nghe lại câu trả lời trước khi nộp bài đánh giá.",
    initialAudioUrl:
      "https://actions.google.com/sounds/v1/speech/greeting_male.ogg",
    initialDurationSeconds: 38,
    maxDurationSeconds: 60,
  },
};

/**
 * 3. Part 2 Long Turn with 2-minute (120s) timer progress
 */
export const Part2LongTurn120s: Story = {
  args: {
    title: "IELTS Speaking Part 2 - Cue Card Long Turn",
    description:
      "Describe a skill you learned that was important to you. You should speak for up to 2 minutes.",
    maxDurationSeconds: 120,
  },
};

/**
 * 4. Error State: Microphone Permission Denied
 */
export const ErrorPermissionDenied: Story = {
  args: {
    title: "IELTS Speaking Part 3 - Discussion",
    description: "Permission denied simulation.",
  },
  beforeEach: () => {
    mockPermissionDenied();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const startBtn = canvas.getByTestId("start-record-btn");
    await userEvent.click(startBtn);

    const errorPanel = await canvas.findByTestId("error-panel");
    await expect(errorPanel).toBeInTheDocument();
    await expect(errorPanel).toHaveTextContent(
      "Quyền truy cập Microphone bị từ chối"
    );
  },
};

/**
 * 5. Error State: No Microphone Device Found
 */
export const ErrorDeviceNotFound: Story = {
  args: {
    title: "IELTS Speaking - Hardware Check",
    description: "Device not found simulation.",
  },
  beforeEach: () => {
    mockDeviceNotFound();
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const startBtn = canvas.getByTestId("start-record-btn");
    await userEvent.click(startBtn);

    const errorPanel = await canvas.findByTestId("error-panel");
    await expect(errorPanel).toBeInTheDocument();
    await expect(errorPanel).toHaveTextContent("Không tìm thấy Microphone");
  },
};

/**
 * 6. Interaction Test: Complete Recording Lifecycle (Idle -> Recording -> Stop -> Playback -> Play)
 */
export const FullRecordingCycleTest: Story = {
  args: {
    title: "Interaction Test: Complete Recording Lifecycle",
    description: "Automated test for record, stop, and playback flow.",
    maxDurationSeconds: 60,
  },
  play: async ({ canvasElement }) => {
    resetAudioMocks();
    const canvas = within(canvasElement);

    // 1. Check initial Idle status
    const statusBadge = canvas.getByTestId("status-badge");
    await expect(statusBadge).toHaveTextContent("Sẵn sàng");

    // 2. Click Start Recording
    const startBtn = canvas.getByTestId("start-record-btn");
    await userEvent.click(startBtn);

    // 3. Verify Recording state & timer
    const recordingPanel = await canvas.findByTestId("recording-panel");
    await expect(recordingPanel).toBeInTheDocument();
    const activeBadge = await canvas.findByTestId("status-badge");
    await expect(activeBadge).toHaveTextContent("Đang ghi âm");

    const timer = canvas.getByTestId("recording-timer");
    await expect(timer).toBeInTheDocument();

    // 4. Click Stop Recording
    const stopBtn = canvas.getByTestId("stop-record-btn");
    await userEvent.click(stopBtn);

    // 5. Verify Playback state
    const playbackPanel = await canvas.findByTestId("playback-panel");
    await expect(playbackPanel).toBeInTheDocument();
    const playbackBadge = await canvas.findByTestId("status-badge");
    await expect(playbackBadge).toHaveTextContent("Đã có bản thu");

    // 6. Test Play audio button
    const playBtn = canvas.getByTestId("play-audio-btn");
    await expect(playBtn).toBeInTheDocument();
    await userEvent.click(playBtn);
  },
};

/**
 * 7. Interaction Test: Re-record Confirmation Dialog Flow
 */
export const ReRecordConfirmationFlowTest: Story = {
  args: {
    title: "Interaction Test: Re-record Confirmation Flow",
    description: "Automated test for re-recording safety dialog.",
    maxDurationSeconds: 60,
  },
  play: async ({ canvasElement }) => {
    resetAudioMocks();
    const canvas = within(canvasElement);

    // 1. Start and Stop recording to reach Playback state
    const startBtn = canvas.getByTestId("start-record-btn");
    await userEvent.click(startBtn);

    const stopBtn = await canvas.findByTestId("stop-record-btn");
    await userEvent.click(stopBtn);

    await canvas.findByTestId("playback-panel");

    // 2. Click Re-record button
    const reRecordBtn = canvas.getByTestId("rerecord-btn");
    await userEvent.click(reRecordBtn);

    // 3. Confirm Dialog is displayed
    const confirmBtn = await within(document.body).findByTestId(
      "confirm-rerecord-btn"
    );
    await expect(confirmBtn).toBeInTheDocument();

    // 4. Click Confirm Re-record
    await userEvent.click(confirmBtn);

    // 5. Verify recorder returns to active recording
    const recordingPanel = await canvas.findByTestId("recording-panel");
    await expect(recordingPanel).toBeInTheDocument();
  },
};

/**
 * 8. Interaction Test: Permission Denied Recovery Flow
 */
export const PermissionDeniedRecoveryTest: Story = {
  args: {
    title: "Interaction Test: Permission Recovery",
    description: "Automated test for recovering from permission error.",
  },
  play: async ({ canvasElement }) => {
    // 1. Force permission denied
    mockPermissionDenied();
    const canvas = within(canvasElement);

    const startBtn = canvas.getByTestId("start-record-btn");
    await userEvent.click(startBtn);

    // 2. Check error panel appears
    const errorPanel = await canvas.findByTestId("error-panel");
    await expect(errorPanel).toBeInTheDocument();

    // 3. Fix mock permissions
    resetAudioMocks();

    // 4. Click Retry
    const retryBtn = canvas.getByTestId("retry-permission-btn");
    await userEvent.click(retryBtn);

    // 5. Verify recording panel successfully started
    const recordingPanel = await canvas.findByTestId("recording-panel");
    await expect(recordingPanel).toBeInTheDocument();
  },
};

/**
 * 9. Interaction Test: WASM AI Noise Filter Toggle
 */
export const WasmNoiseFilterToggleTest: Story = {
  args: {
    title: "Interaction Test: WASM AI Noise Filter",
    description:
      "Automated test for toggling WASM background noise filter ON/OFF.",
    enableNoiseSuppression: true,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const filterBtn = canvas.getByTestId("noise-suppression-toggle-badge");
    await expect(filterBtn).toHaveTextContent("WASM Filter ON");

    // Click to toggle OFF
    await userEvent.click(filterBtn);
    await expect(filterBtn).toHaveTextContent("WASM Filter OFF");

    // Click to toggle back ON
    await userEvent.click(filterBtn);
    await expect(filterBtn).toHaveTextContent("WASM Filter ON");
  },
};
