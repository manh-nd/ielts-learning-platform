import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { Card, CardContent } from "./card";

const meta: Meta<typeof Tabs> = {
  title: "UI/Tabs",
  component: Tabs,
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="writing" className="w-96">
      <TabsList>
        <TabsTrigger value="writing">Writing Practice</TabsTrigger>
        <TabsTrigger value="speaking">Speaking Practice</TabsTrigger>
        <TabsTrigger value="history">History</TabsTrigger>
      </TabsList>
      <TabsContent value="writing">
        <Card className="mt-3">
          <CardContent className="p-4 text-xs">
            IELTS Academic & General Writing tasks with real-time word counter.
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="speaking">
        <Card className="mt-3">
          <CardContent className="p-4 text-xs">
            Speaking Part 1, 2 & 3 with interactive AI Audio examiner.
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="history">
        <Card className="mt-3">
          <CardContent className="p-4 text-xs">
            Review past submission attempts and published teacher feedback.
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  ),
};

export const LineVariant: Story = {
  render: () => (
    <Tabs defaultValue="ta" className="w-96">
      <TabsList variant="line">
        <TabsTrigger value="ta">TA / TR</TabsTrigger>
        <TabsTrigger value="cc">CC</TabsTrigger>
        <TabsTrigger value="lr">LR</TabsTrigger>
        <TabsTrigger value="gra">GRA</TabsTrigger>
      </TabsList>
      <TabsContent value="ta" className="p-3 text-xs">
        Task Response: Clear position presented with relevant main ideas.
      </TabsContent>
      <TabsContent value="cc" className="p-3 text-xs">
        Coherence & Cohesion: Paragraphs logically ordered with cohesive
        devices.
      </TabsContent>
      <TabsContent value="lr" className="p-3 text-xs">
        Lexical Resource: Wide range of academic vocabulary with rare
        inaccuracies.
      </TabsContent>
      <TabsContent value="gra" className="p-3 text-xs">
        Grammar Range: Complex sentence structures with high accuracy rate.
      </TabsContent>
    </Tabs>
  ),
};

export const SwitchTabInteractionTest: Story = {
  render: () => (
    <Tabs defaultValue="tab1" className="w-80">
      <TabsList>
        <TabsTrigger value="tab1" data-testid="tab-trigger-1">
          Proposal
        </TabsTrigger>
        <TabsTrigger value="tab2" data-testid="tab-trigger-2">
          Assessment
        </TabsTrigger>
      </TabsList>
      <TabsContent value="tab1" data-testid="tab-content-1">
        AI Proposal Content
      </TabsContent>
      <TabsContent value="tab2" data-testid="tab-content-2">
        Teacher Assessment Content
      </TabsContent>
    </Tabs>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger1 = canvas.getByTestId("tab-trigger-1");
    const trigger2 = canvas.getByTestId("tab-trigger-2");

    await expect(canvas.getByTestId("tab-content-1")).toBeInTheDocument();
    await userEvent.click(trigger2);
    await expect(canvas.getByTestId("tab-content-2")).toBeInTheDocument();
    await userEvent.click(trigger1);
    await expect(canvas.getByTestId("tab-content-1")).toBeInTheDocument();
  },
};
