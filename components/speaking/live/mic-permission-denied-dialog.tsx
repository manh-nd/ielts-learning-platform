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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MicOff, RefreshCw, AlertTriangle, CheckCircle } from "lucide-react";

export interface MicPermissionDeniedDialogProps {
  open: boolean;
  onRetry: () => void;
  onClose: () => void;
}

export function MicPermissionDeniedDialog({
  open,
  onRetry,
  onClose,
}: MicPermissionDeniedDialogProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [testResult, setTestResult] = useState<
    "success" | "still_denied" | null
  >(null);

  const handleTestPermission = async () => {
    setIsChecking(true);
    setTestResult(null);
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.mediaDevices?.getUserMedia
      ) {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // Success! Stop test tracks immediately
        stream.getTracks().forEach((track) => track.stop());
        setTestResult("success");
        setTimeout(() => {
          onRetry();
        }, 600);
      } else {
        onRetry();
      }
    } catch (err) {
      console.warn("[MicPermissionDenied] Permission still not granted:", err);
      setTestResult("still_denied");
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        data-testid="mic-permission-denied-dialog"
        className="sm:max-w-lg p-6 gap-4"
        showCloseButton={true}
      >
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <MicOff className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-bold text-foreground">
                Quyền Microphone Bị Từ Chối
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Trình duyệt đang chặn quyền truy cập Micro. Vui lòng làm theo
                hướng dẫn dưới đây để mở lại:
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="chrome" className="w-full">
          <TabsList className="grid grid-cols-3 w-full h-8 text-xs">
            <TabsTrigger value="chrome" className="text-xs">
              Chrome / Edge
            </TabsTrigger>
            <TabsTrigger value="safari" className="text-xs">
              Safari (iOS/Mac)
            </TabsTrigger>
            <TabsTrigger value="firefox" className="text-xs">
              Firefox
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="chrome"
            className="mt-3 space-y-2 text-xs text-foreground/90 bg-muted/30 p-3 rounded-lg border"
          >
            <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
              <li>
                Nhấn vào biểu tượng <strong>Cài đặt trang / Ổ khóa</strong> bên
                trái thanh địa chỉ URL.
              </li>
              <li>
                Tìm mục <strong>Microphone</strong> và chuyển trạng thái thành{" "}
                <strong>&ldquo;Cho phép&rdquo; (Allow)</strong>.
              </li>
              <li>
                Nhấn nút <strong>&ldquo;Kiểm tra lại quyền&rdquo;</strong> bên
                dưới.
              </li>
            </ol>
          </TabsContent>

          <TabsContent
            value="safari"
            className="mt-3 space-y-2 text-xs text-foreground/90 bg-muted/30 p-3 rounded-lg border"
          >
            <div className="space-y-2 leading-relaxed">
              <p>
                <strong>Trên iPhone/iPad (iOS):</strong> Vào{" "}
                <em>
                  Cài đặt (Settings) &rarr; Safari &rarr; Microphone &rarr; Chọn
                  &ldquo;Cho phép&rdquo;
                </em>
                .
              </p>
              <p>
                <strong>Trên Mac (macOS):</strong> Vào{" "}
                <em>
                  Safari &rarr; Cài đặt (Settings) &rarr; Trang web (Websites)
                  &rarr; Microphone &rarr; Đặt trang này thành &ldquo;Cho
                  phép&rdquo;
                </em>
                .
              </p>
            </div>
          </TabsContent>

          <TabsContent
            value="firefox"
            className="mt-3 space-y-2 text-xs text-foreground/90 bg-muted/30 p-3 rounded-lg border"
          >
            <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
              <li>
                Nhấn vào biểu tượng <strong>Microphone bị gạch chéo</strong>{" "}
                trên thanh địa chỉ.
              </li>
              <li>
                Nhấn nút{" "}
                <strong>&ldquo;Xóa quyền chặn&rdquo; (Clear Block)</strong>.
              </li>
              <li>
                Nhấn nút <strong>&ldquo;Kiểm tra lại quyền&rdquo;</strong> và
                chọn <em>&ldquo;Cho phép&rdquo;</em> khi trình duyệt hỏi lại.
              </li>
            </ol>
          </TabsContent>
        </Tabs>

        {testResult === "still_denied" && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Microphone vẫn chưa được cấp quyền. Vui lòng kiểm tra lại cài đặt
              trình duyệt.
            </AlertDescription>
          </Alert>
        )}

        {testResult === "success" && (
          <Alert variant="success">
            <CheckCircle className="w-4 h-4" />
            <AlertDescription className="text-xs">
              Đã cấp quyền Microphone thành công! Đang mở phòng thi...
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="cursor-pointer text-xs"
          >
            Đóng
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleTestPermission}
            disabled={isChecking}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold cursor-pointer text-xs gap-1.5"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isChecking ? "animate-spin" : ""}`}
            />
            <span>
              {isChecking ? "Đang kiểm tra..." : "Kiểm tra lại quyền"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
