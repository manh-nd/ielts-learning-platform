import type { Meta, StoryObj } from "@storybook/react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from "./card";
import { Button } from "./button";
import { Badge } from "./badge";
import { Sparkles, ArrowRight } from "lucide-react";

const meta: Meta<typeof Card> = {
  title: "Design System/Primitives/Card",
  component: Card,
  tags: ["autodocs"],
  argTypes: {
    size: {
      control: "select",
      options: ["default", "sm"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  render: (args) => (
    <Card className="w-full max-w-sm" {...args}>
      <CardHeader>
        <CardTitle>Writing Task 2 Assessment</CardTitle>
        <CardDescription>
          Feedback on coherence, cohesion, and task response.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          The essay demonstrates clear paragraphing and an effective progression
          of ideas throughout the response.
        </p>
      </CardContent>
      <CardFooter className="justify-between border-t">
        <span className="font-semibold text-xs">Band Score: 7.0</span>
        <Button size="sm" variant="outline">
          View Detail
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const SmallSize: Story = {
  render: () => (
    <Card size="sm" className="w-full max-w-xs">
      <CardHeader>
        <CardTitle>Fluency & Coherence</CardTitle>
        <CardDescription>Speaking Part 2 evaluation</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Good flow with minimal hesitation.
        </p>
      </CardContent>
      <CardFooter className="justify-end">
        <Badge variant="secondary">Band 7.5</Badge>
      </CardFooter>
    </Card>
  ),
};

export const WithCardAction: Story = {
  render: () => (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>AI Proposal Draft</CardTitle>
        <CardDescription>Đề xuất chấm điểm từ AI</CardDescription>
        <CardAction>
          <Badge variant="default" className="gap-1">
            <Sparkles className="size-2.5" />
            AI Ready
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">
          Calculated overall score proposal: <strong>7.0</strong> based on 4
          IELTS assessment criteria.
        </p>
      </CardContent>
      <CardFooter className="justify-between border-t">
        <Button size="sm" variant="ghost">
          Dismiss
        </Button>
        <Button size="sm" className="gap-1">
          Apply to Assessment <ArrowRight className="size-3" />
        </Button>
      </CardFooter>
    </Card>
  ),
};
