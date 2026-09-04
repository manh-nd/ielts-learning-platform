"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldCheck, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export interface FreeTierConsentNoticeModalProps {
  open: boolean;
  onConsent: () => void;
  onCancel?: () => void;
}

export function FreeTierConsentNoticeModal({
  open,
  onConsent,
  onCancel,
}: FreeTierConsentNoticeModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/learner/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error("Không thể ghi nhận đồng thuận. Vui lòng thử lại.");
      }

      onConsent();
    } catch (err: unknown) {
      console.error("[FreeTierConsentNotice] Consent error:", err);
      setError((err as Error)?.message || "Đã xảy ra lỗi khi lưu đồng thuận.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel?.()}>
      <DialogContent
        data-testid="free-tier-consent-modal"
        className="sm:max-w-md p-6 gap-4"
        showCloseButton={false}
      >
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Xác nhận Điều khoản Thử nghiệm AI
              </DialogTitle>
              <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300 font-semibold">
                Google Gemini Free Tier Pilot
              </span>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed pt-1">
            Trước khi cấp quyền microphone và bắt đầu luyện tập IELTS Speaking,
            vui lòng xác nhận bạn đã hiểu và đồng ý với các điều khoản bảo vệ dữ
            liệu dưới đây:
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs text-foreground/90 bg-muted/30 p-4 rounded-lg border border-border/70">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
            <span>
              <strong>Độ tuổi:</strong> Bạn xác nhận mình từ{" "}
              <strong>đủ 18 tuổi trở lên</strong> để tham gia thử nghiệm.
            </span>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-700 dark:text-indigo-400 shrink-0 mt-0.5" />
            <span>
              <strong>Xử lý AI:</strong> Âm thanh và văn bản gỡ băng được truyền
              tới Google Gemini API phục vụ phân tích 4 tiêu chí IELTS. Theo
              điều khoản Free Tier của Google, dữ liệu có thể được sử dụng để
              cải thiện chất lượng dịch vụ.
            </span>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-blue-700 dark:text-blue-400 shrink-0 mt-0.5" />
            <span>
              <strong>Quyền riêng tư tuyệt đối:</strong> Phiên tự luyện Speaking
              là hoàn toàn riêng tư. Giáo viên của bạn{" "}
              <strong>không có quyền</strong> xem hoặc truy cập bài làm này.
            </span>
          </div>

          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-700 dark:text-purple-400 shrink-0 mt-0.5" />
            <span>
              <strong>Thời hạn lưu trữ:</strong> Bản thu âm được lưu tạm thời
              tối đa 14 ngày và bạn có thể yêu cầu xóa vĩnh viễn bất kỳ lúc nào.
            </span>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-2 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSubmitting}
              className="cursor-pointer text-xs"
            >
              Hủy bỏ
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer text-xs gap-1.5"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang lưu...</span>
              </>
            ) : (
              <span>Tôi đủ 18 tuổi & Đồng ý</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
