using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

namespace AsaCad.KompasCapture
{
    public sealed class RectData
    {
        public double X { get; set; }
        public double Y { get; set; }
        public double Width { get; set; }
        public double Height { get; set; }
        public bool IsValid { get; set; }
    }

    public sealed class CoordinateRectData
    {
        public RectData ScreenPhysicalPx { get; set; }
        public RectData ClientPhysicalPx { get; set; }
        public RectData ClientDip { get; set; }
        public RectData ClientNormalized { get; set; }
    }

    public sealed class WindowData
    {
        public long Hwnd { get; set; }
        public int ProcessId { get; set; }
        public string ProcessName { get; set; }
        public string ProcessPath { get; set; }
        public string Title { get; set; }
        public RectData WindowRectPhysicalPx { get; set; }
        public RectData ExtendedFrameRectPhysicalPx { get; set; }
        public RectData ClientRectScreenPhysicalPx { get; set; }
        public RectData MonitorBoundsPhysicalPx { get; set; }
        public RectData MonitorWorkAreaPhysicalPx { get; set; }
        public string MonitorDeviceName { get; set; }
        public uint DpiX { get; set; }
        public uint DpiY { get; set; }
        public double WindowsScalePercent { get; set; }
        public bool IsForeground { get; set; }
        public bool IsIconic { get; set; }
        public bool IsZoomed { get; set; }
    }

    public sealed class ResizeResult
    {
        public bool Attempted { get; set; }
        public bool Success { get; set; }
        public int Iterations { get; set; }
        public int TargetWidth { get; set; }
        public int TargetHeight { get; set; }
        public int ActualWidth { get; set; }
        public int ActualHeight { get; set; }
        public string Message { get; set; }
    }

    public sealed class UiaNodeData
    {
        public int[] RuntimeId { get; set; }
        public int[] ParentRuntimeId { get; set; }
        public int SiblingOrder { get; set; }
        public int ProcessId { get; set; }
        public string AutomationId { get; set; }
        public string Name { get; set; }
        public string Value { get; set; }
        public string ControlType { get; set; }
        public string LocalizedControlType { get; set; }
        public string ClassName { get; set; }
        public string FrameworkId { get; set; }
        public bool Enabled { get; set; }
        public bool Offscreen { get; set; }
        public bool IsKeyboardFocusable { get; set; }
        public bool HasKeyboardFocus { get; set; }
        public CoordinateRectData BoundingRect { get; set; }
        public List<string> SupportedPatterns { get; set; }
        public List<UiaNodeData> Children { get; set; }
    }

    public sealed class UiaTreeData
    {
        public string View { get; set; }
        public int VisibleNodeCount { get; set; }
        public int ValidBoundingRectCount { get; set; }
        public int NamedNodeCount { get; set; }
        public int TotalNodeCount { get; set; }
        public bool Truncated { get; set; }
        public UiaNodeData Root { get; set; }
    }

    public sealed class ScreenshotResult
    {
        public string CaptureMethod { get; set; }
        public string LocalPath { get; set; }
        public int Width { get; set; }
        public int Height { get; set; }
        public RectData CaptureRectPhysicalPx { get; set; }
        public bool WindowWasForeground { get; set; }
        public bool WindowWasUnobscured { get; set; }
        public bool CursorIncluded { get; set; }
    }

    public sealed class StabilitySnapshotData
    {
        public RectData ClientRectPhysicalPx { get; set; }
        public string TreeSignature { get; set; }
        public string MajorZoneSignature { get; set; }
        public int VisibleNodeCount { get; set; }
        public int VisibleTooltipCount { get; set; }
    }

    public static class NativeCapture
    {
        private const int DWMWA_EXTENDED_FRAME_BOUNDS = 9;
        private const uint MONITOR_DEFAULTTONEAREST = 2;
        private const uint SWP_NOZORDER = 0x0004;
        private const uint SWP_NOACTIVATE = 0x0010;
        private const int SW_RESTORE = 9;
        private const uint GA_ROOT = 2;
        private static bool _treeTruncated;

        [StructLayout(LayoutKind.Sequential)]
        private struct RECT { public int Left, Top, Right, Bottom; }

        [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
        private struct MONITORINFOEX
        {
            public int cbSize;
            public RECT rcMonitor;
            public RECT rcWork;
            public uint dwFlags;
            [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string szDevice;
        }

        private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

        [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc callback, IntPtr lParam);
        [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern int GetWindowTextLength(IntPtr hWnd);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hWnd, StringBuilder value, int count);
        [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
        [DllImport("user32.dll")] private static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
        [DllImport("user32.dll")] private static extern bool GetClientRect(IntPtr hWnd, out RECT rect);
        [DllImport("user32.dll")] private static extern bool ClientToScreen(IntPtr hWnd, ref Point point);
        [DllImport("user32.dll")] private static extern uint GetDpiForWindow(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern IntPtr MonitorFromWindow(IntPtr hWnd, uint flags);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern bool GetMonitorInfo(IntPtr monitor, ref MONITORINFOEX info);
        [DllImport("user32.dll")] private static extern bool SetWindowPos(IntPtr hWnd, IntPtr insertAfter, int x, int y, int cx, int cy, uint flags);
        [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int x, int y, int width, int height, bool repaint);
        [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int command);
        [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern IntPtr SetActiveWindow(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
        [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint attach, uint attachTo, bool value);
        [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern bool IsZoomed(IntPtr hWnd);
        [DllImport("user32.dll")] private static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll")] private static extern void mouse_event(uint flags, uint dx, uint dy, uint data, UIntPtr extraInfo);
        [DllImport("user32.dll")] private static extern IntPtr WindowFromPoint(Point point);
        [DllImport("user32.dll")] private static extern IntPtr GetAncestor(IntPtr hWnd, uint flags);
        [DllImport("user32.dll")] private static extern bool SetProcessDpiAwarenessContext(IntPtr context);
        [DllImport("user32.dll")] private static extern IntPtr GetThreadDpiAwarenessContext();
        [DllImport("user32.dll")] private static extern int GetAwarenessFromDpiAwarenessContext(IntPtr context);
        [DllImport("user32.dll")] private static extern bool AreDpiAwarenessContextsEqual(IntPtr first, IntPtr second);
        [DllImport("dwmapi.dll")] private static extern int DwmGetWindowAttribute(IntPtr hWnd, int attribute, out RECT value, int size);

        public static string EnsureDpiAwareness()
        {
            try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { }
            try
            {
                IntPtr context = GetThreadDpiAwarenessContext();
                if (AreDpiAwarenessContextsEqual(context, new IntPtr(-4))) return "per-monitor-v2";
                int awareness = GetAwarenessFromDpiAwarenessContext(context);
                if (awareness == 2) return "per-monitor-aware";
                if (awareness == 1) return "system-aware";
                if (awareness == 0) return "unaware";
                return "invalid";
            }
            catch { return "unknown"; }
        }

        public static WindowData[] FindKompasWindows()
        {
            var result = new List<WindowData>();
            EnumWindows(delegate (IntPtr hWnd, IntPtr unused)
            {
                if (!IsWindowVisible(hWnd) || GetWindowTextLength(hWnd) == 0) return true;
                uint pid;
                GetWindowThreadProcessId(hWnd, out pid);
                try
                {
                    var process = Process.GetProcessById((int)pid);
                    string name = process.ProcessName ?? "";
                    string title = ReadWindowTitle(hWnd);
                    if (!name.Equals("kStudy", StringComparison.OrdinalIgnoreCase) &&
                        title.IndexOf("КОМПАС-3D v25", StringComparison.OrdinalIgnoreCase) < 0 &&
                        title.IndexOf("KOMPAS-3D v25", StringComparison.OrdinalIgnoreCase) < 0) return true;
                    result.Add(ReadWindow(hWnd));
                }
                catch { }
                return true;
            }, IntPtr.Zero);
            return result.ToArray();
        }

        public static WindowData ReadWindow(long hwndValue)
        {
            IntPtr hWnd = new IntPtr(hwndValue);
            uint pid;
            GetWindowThreadProcessId(hWnd, out pid);
            Process process = Process.GetProcessById((int)pid);
            RECT windowRect;
            if (!GetWindowRect(hWnd, out windowRect)) throw new InvalidOperationException("GetWindowRect failed");
            RECT clientLocal;
            if (!GetClientRect(hWnd, out clientLocal)) throw new InvalidOperationException("GetClientRect failed");
            Point clientOrigin = new Point(0, 0);
            if (!ClientToScreen(hWnd, ref clientOrigin)) throw new InvalidOperationException("ClientToScreen failed");
            RECT extended = windowRect;
            DwmGetWindowAttribute(hWnd, DWMWA_EXTENDED_FRAME_BOUNDS, out extended, Marshal.SizeOf(typeof(RECT)));
            IntPtr monitor = MonitorFromWindow(hWnd, MONITOR_DEFAULTTONEAREST);
            var monitorInfo = new MONITORINFOEX { cbSize = Marshal.SizeOf(typeof(MONITORINFOEX)) };
            if (!GetMonitorInfo(monitor, ref monitorInfo)) throw new InvalidOperationException("GetMonitorInfo failed");
            uint dpi = GetDpiForWindow(hWnd);
            if (dpi == 0) dpi = 96;
            string path = "";
            try { path = process.MainModule.FileName; } catch { }
            return new WindowData
            {
                Hwnd = hWnd.ToInt64(),
                ProcessId = (int)pid,
                ProcessName = process.ProcessName,
                ProcessPath = path,
                Title = ReadWindowTitle(hWnd),
                WindowRectPhysicalPx = FromRect(windowRect),
                ExtendedFrameRectPhysicalPx = FromRect(extended),
                ClientRectScreenPhysicalPx = new RectData { X = clientOrigin.X, Y = clientOrigin.Y, Width = clientLocal.Right - clientLocal.Left, Height = clientLocal.Bottom - clientLocal.Top, IsValid = true },
                MonitorBoundsPhysicalPx = FromRect(monitorInfo.rcMonitor),
                MonitorWorkAreaPhysicalPx = FromRect(monitorInfo.rcWork),
                MonitorDeviceName = monitorInfo.szDevice,
                DpiX = dpi,
                DpiY = dpi,
                WindowsScalePercent = Math.Round(dpi * 100.0 / 96.0, 4),
                IsForeground = GetForegroundWindow() == hWnd,
                IsIconic = IsIconic(hWnd),
                IsZoomed = IsZoomed(hWnd)
            };
        }

        public static ResizeResult ResizeClient(long hwndValue, int targetWidth, int targetHeight)
        {
            IntPtr hWnd = new IntPtr(hwndValue);
            var result = new ResizeResult { Attempted = true, TargetWidth = targetWidth, TargetHeight = targetHeight };
            ShowWindow(hWnd, SW_RESTORE);
            Thread.Sleep(250);
            for (int iteration = 1; iteration <= 8; iteration++)
            {
                WindowData current = ReadWindow(hwndValue);
                int actualWidth = (int)current.ClientRectScreenPhysicalPx.Width;
                int actualHeight = (int)current.ClientRectScreenPhysicalPx.Height;
                result.Iterations = iteration;
                result.ActualWidth = actualWidth;
                result.ActualHeight = actualHeight;
                if (Math.Abs(actualWidth - targetWidth) <= 1 && Math.Abs(actualHeight - targetHeight) <= 1)
                {
                    result.Success = true;
                    result.Message = "client target reached within 1 px";
                    return result;
                }
                int outerWidth = (int)current.WindowRectPhysicalPx.Width + (targetWidth - actualWidth);
                int outerHeight = (int)current.WindowRectPhysicalPx.Height + (targetHeight - actualHeight);
                int x = (int)Math.Max(current.MonitorWorkAreaPhysicalPx.X, Math.Min(current.WindowRectPhysicalPx.X, current.MonitorWorkAreaPhysicalPx.X + current.MonitorWorkAreaPhysicalPx.Width - outerWidth));
                int y = (int)Math.Max(current.MonitorWorkAreaPhysicalPx.Y, Math.Min(current.WindowRectPhysicalPx.Y, current.MonitorWorkAreaPhysicalPx.Y + current.MonitorWorkAreaPhysicalPx.Height - outerHeight));
                if (!SetWindowPos(hWnd, IntPtr.Zero, x, y, outerWidth, outerHeight, SWP_NOZORDER | SWP_NOACTIVATE))
                {
                    result.Message = "SetWindowPos failed";
                    return result;
                }
                Thread.Sleep(250);
            }
            WindowData final = ReadWindow(hwndValue);
            result.ActualWidth = (int)final.ClientRectScreenPhysicalPx.Width;
            result.ActualHeight = (int)final.ClientRectScreenPhysicalPx.Height;
            result.Success = Math.Abs(result.ActualWidth - targetWidth) <= 1 && Math.Abs(result.ActualHeight - targetHeight) <= 1;
            result.Message = result.Success ? "client target reached within 1 px" : "window manager or application clamped target client size";
            return result;
        }

        public static bool ActivateWindow(long hwndValue)
        {
            IntPtr hWnd = new IntPtr(hwndValue);
            IntPtr foreground = GetForegroundWindow();
            uint unused;
            uint foregroundThread = foreground == IntPtr.Zero ? 0 : GetWindowThreadProcessId(foreground, out unused);
            uint targetThread = GetWindowThreadProcessId(hWnd, out unused);
            uint currentThread = GetCurrentThreadId();
            bool attachedForeground = false;
            bool attachedTarget = false;
            try
            {
                if (foregroundThread != 0 && foregroundThread != currentThread)
                    attachedForeground = AttachThreadInput(currentThread, foregroundThread, true);
                if (targetThread != 0 && targetThread != currentThread)
                    attachedTarget = AttachThreadInput(currentThread, targetThread, true);
                ShowWindow(hWnd, SW_RESTORE);
                BringWindowToTop(hWnd);
                SetActiveWindow(hWnd);
                SetForegroundWindow(hWnd);
            }
            finally
            {
                if (attachedTarget) AttachThreadInput(currentThread, targetThread, false);
                if (attachedForeground) AttachThreadInput(currentThread, foregroundThread, false);
            }
            Thread.Sleep(300);
            return GetForegroundWindow() == hWnd;
        }

        public static bool ClickClientCoordinate(long hwndValue, int clientX, int clientY)
        {
            IntPtr hWnd = new IntPtr(hwndValue);
            if (!ActivateWindow(hwndValue)) return false;
            Point point = new Point(clientX, clientY);
            if (!ClientToScreen(hWnd, ref point)) return false;
            if (!SetCursorPos(point.X, point.Y)) return false;
            Thread.Sleep(150);
            mouse_event(0x0002, 0, 0, 0, UIntPtr.Zero);
            mouse_event(0x0004, 0, 0, 0, UIntPtr.Zero);
            Thread.Sleep(350);
            return true;
        }

        public static void RestoreWindow(long hwndValue, RectData outerRect)
        {
            if (outerRect == null || !outerRect.IsValid) return;
            MoveWindow(new IntPtr(hwndValue), (int)outerRect.X, (int)outerRect.Y, (int)outerRect.Width, (int)outerRect.Height, true);
        }

        public static UiaTreeData CaptureControlView(long hwndValue, int maxDepth, int maxNodes)
        {
            WindowData window = ReadWindow(hwndValue);
            AutomationElement root = AutomationElement.FromHandle(new IntPtr(hwndValue));
            int count = 0;
            int visible = 0;
            int validRect = 0;
            int named = 0;
            _treeTruncated = false;
            UiaNodeData rootData = BuildNode(root, null, 0, 0, maxDepth, maxNodes, window, ref count, ref visible, ref validRect, ref named);
            return new UiaTreeData
            {
                View = "Control",
                TotalNodeCount = count,
                VisibleNodeCount = visible,
                ValidBoundingRectCount = validRect,
                NamedNodeCount = named,
                Truncated = _treeTruncated,
                Root = rootData
            };
        }

        public static StabilitySnapshotData CaptureStabilitySnapshot(long hwndValue)
        {
            WindowData window = ReadWindow(hwndValue);
            AutomationElement root = AutomationElement.FromHandle(new IntPtr(hwndValue));
            var rows = new List<string>();
            int tooltips = 0;
            var request = new CacheRequest
            {
                TreeScope = TreeScope.Element | TreeScope.Descendants,
                TreeFilter = Automation.ControlViewCondition
            };
            request.Add(AutomationElement.AutomationIdProperty);
            request.Add(AutomationElement.NameProperty);
            request.Add(AutomationElement.ControlTypeProperty);
            request.Add(AutomationElement.ClassNameProperty);
            request.Add(AutomationElement.BoundingRectangleProperty);
            request.Add(AutomationElement.IsOffscreenProperty);
            AutomationElement cachedRoot = root.GetUpdatedCache(request);
            CollectStabilityElements(cachedRoot, rows, ref tooltips);
            rows.Sort(StringComparer.Ordinal);
            string majorSignature = String.Join("\n", rows);
            return new StabilitySnapshotData
            {
                ClientRectPhysicalPx = window.ClientRectScreenPhysicalPx,
                TreeSignature = majorSignature,
                MajorZoneSignature = majorSignature,
                VisibleNodeCount = rows.Count,
                VisibleTooltipCount = tooltips
            };
        }

        private static void CollectStabilityElements(AutomationElement element, List<string> rows, ref int tooltips)
        {
            if (element == null) return;
            bool offscreen = Safe(delegate { return element.Cached.IsOffscreen; }, true);
            string automationId = Safe(delegate { return element.Cached.AutomationId; }, "");
            string name = Safe(delegate { return element.Cached.Name; }, "");
            string controlType = Safe(delegate { return TrimProgrammaticName(element.Cached.ControlType.ProgrammaticName); }, "unknown");
            string className = Safe(delegate { return element.Cached.ClassName; }, "");
            if (!offscreen && controlType == "ToolTip") tooltips++;
            bool isMajor = automationId == "PART_MainMenu" || automationId == "|SearchTextBox" || automationId == "PART_ContextPresenter" ||
                automationId == "_layoutPresenter" || automationId == "TbSetREGIME_SOLID1" || automationId == "Resizable_LeftHub_DockingTabControl_0|" ||
                className == "WorkareaControl" || className == "D3View";
            if (!offscreen && isMajor)
            {
                System.Windows.Rect bounds = Safe(delegate { return element.Cached.BoundingRectangle; }, System.Windows.Rect.Empty);
                rows.Add(String.Join("|", automationId, name, controlType, className, Math.Round(bounds.X), Math.Round(bounds.Y), Math.Round(bounds.Width), Math.Round(bounds.Height)));
            }
            try
            {
                foreach (AutomationElement child in element.CachedChildren)
                    CollectStabilityElements(child, rows, ref tooltips);
            }
            catch { }
        }

        public static bool SetUiaValue(long hwndValue, string automationId, string value)
        {
            AutomationElement root = AutomationElement.FromHandle(new IntPtr(hwndValue));
            AutomationElement element = root.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.AutomationIdProperty, automationId));
            if (element == null) return false;
            object pattern;
            if (!element.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) return false;
            ((ValuePattern)pattern).SetValue(value);
            Thread.Sleep(350);
            return true;
        }

        public static string InvokeUiaElement(long hwndValue, string automationId, string name)
        {
            AutomationElement root = AutomationElement.FromHandle(new IntPtr(hwndValue));
            Condition condition;
            if (!String.IsNullOrWhiteSpace(automationId) && !String.IsNullOrWhiteSpace(name))
                condition = new AndCondition(new PropertyCondition(AutomationElement.AutomationIdProperty, automationId), new PropertyCondition(AutomationElement.NameProperty, name));
            else if (!String.IsNullOrWhiteSpace(automationId))
                condition = new PropertyCondition(AutomationElement.AutomationIdProperty, automationId);
            else
                condition = new PropertyCondition(AutomationElement.NameProperty, name ?? "");
            AutomationElement element = root.FindFirst(TreeScope.Descendants, condition);
            if (element == null) return "not-found";
            object pattern;
            if (element.TryGetCurrentPattern(InvokePattern.Pattern, out pattern)) { ((InvokePattern)pattern).Invoke(); Thread.Sleep(350); return "Invoke"; }
            if (element.TryGetCurrentPattern(SelectionItemPattern.Pattern, out pattern)) { ((SelectionItemPattern)pattern).Select(); Thread.Sleep(350); return "SelectionItem"; }
            if (element.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out pattern)) { ((ExpandCollapsePattern)pattern).Expand(); Thread.Sleep(350); return "ExpandCollapse"; }
            if (element.TryGetCurrentPattern(TogglePattern.Pattern, out pattern)) { ((TogglePattern)pattern).Toggle(); Thread.Sleep(350); return "Toggle"; }
            return "no-supported-action-pattern";
        }

        public static ScreenshotResult CaptureClientPng(long hwndValue, string outputPath)
        {
            IntPtr hWnd = new IntPtr(hwndValue);
            if (IsIconic(hWnd)) throw new InvalidOperationException("KOMPAS window is minimized");
            ActivateWindow(hwndValue);
            WindowData window = ReadWindow(hwndValue);
            RectData rect = window.ClientRectScreenPhysicalPx;
            SetCursorPos((int)(window.MonitorWorkAreaPhysicalPx.X + window.MonitorWorkAreaPhysicalPx.Width - 2), (int)(window.MonitorWorkAreaPhysicalPx.Y + window.MonitorWorkAreaPhysicalPx.Height - 2));
            Thread.Sleep(250);
            bool foreground = GetForegroundWindow() == hWnd;
            bool unobscured = IsClientUnobscured(hWnd, rect);
            Directory.CreateDirectory(Path.GetDirectoryName(outputPath));
            using (var bitmap = new Bitmap((int)rect.Width, (int)rect.Height, PixelFormat.Format32bppArgb))
            using (var graphics = Graphics.FromImage(bitmap))
            {
                graphics.CopyFromScreen((int)rect.X, (int)rect.Y, 0, 0, bitmap.Size, CopyPixelOperation.SourceCopy);
                bitmap.Save(outputPath, ImageFormat.Png);
            }
            return new ScreenshotResult
            {
                CaptureMethod = "physical-screen-client-crop-copyfromscreen",
                LocalPath = Path.GetFullPath(outputPath),
                Width = (int)rect.Width,
                Height = (int)rect.Height,
                CaptureRectPhysicalPx = rect,
                WindowWasForeground = foreground,
                WindowWasUnobscured = unobscured,
                CursorIncluded = false
            };
        }

        private static UiaNodeData BuildNode(AutomationElement element, int[] parentRuntimeId, int siblingOrder, int depth, int maxDepth, int maxNodes, WindowData window, ref int count, ref int visible, ref int validRect, ref int named)
        {
            if (element == null || count >= maxNodes) { _treeTruncated = true; return null; }
            count++;
            int[] runtimeId = Safe(delegate { return element.GetRuntimeId(); }, new int[0]);
            string name = Safe(delegate { return element.Current.Name; }, "");
            bool offscreen = Safe(delegate { return element.Current.IsOffscreen; }, true);
            System.Windows.Rect bounding = Safe(delegate { return element.Current.BoundingRectangle; }, System.Windows.Rect.Empty);
            bool hasValidBounds = !bounding.IsEmpty && !Double.IsInfinity(bounding.X) && !Double.IsInfinity(bounding.Y) &&
                !Double.IsInfinity(bounding.Width) && !Double.IsInfinity(bounding.Height) && bounding.Width > 0 && bounding.Height > 0;
            RectData screenRect = hasValidBounds
                ? new RectData { X = bounding.X, Y = bounding.Y, Width = bounding.Width, Height = bounding.Height, IsValid = true }
                : new RectData { X = 0, Y = 0, Width = 0, Height = 0, IsValid = false };
            if (!offscreen) visible++;
            if (screenRect.IsValid) validRect++;
            if (!String.IsNullOrWhiteSpace(name)) named++;
            var node = new UiaNodeData
            {
                RuntimeId = runtimeId,
                ParentRuntimeId = parentRuntimeId,
                SiblingOrder = siblingOrder,
                ProcessId = Safe(delegate { return element.Current.ProcessId; }, 0),
                AutomationId = Safe(delegate { return element.Current.AutomationId; }, ""),
                Name = name,
                Value = ReadValue(element),
                ControlType = Safe(delegate { return TrimProgrammaticName(element.Current.ControlType.ProgrammaticName); }, "unknown"),
                LocalizedControlType = Safe(delegate { return element.Current.LocalizedControlType; }, ""),
                ClassName = Safe(delegate { return element.Current.ClassName; }, ""),
                FrameworkId = Safe(delegate { return element.Current.FrameworkId; }, ""),
                Enabled = Safe(delegate { return element.Current.IsEnabled; }, false),
                Offscreen = offscreen,
                IsKeyboardFocusable = Safe(delegate { return element.Current.IsKeyboardFocusable; }, false),
                HasKeyboardFocus = Safe(delegate { return element.Current.HasKeyboardFocus; }, false),
                BoundingRect = ConvertCoordinates(screenRect, window),
                SupportedPatterns = ReadPatterns(element),
                Children = new List<UiaNodeData>()
            };
            if (depth >= maxDepth || count >= maxNodes)
            {
                if (count >= maxNodes) _treeTruncated = true;
                return node;
            }
            AutomationElement child = Safe(delegate { return TreeWalker.ControlViewWalker.GetFirstChild(element); }, null);
            int order = 0;
            while (child != null && count < maxNodes)
            {
                UiaNodeData childData = BuildNode(child, runtimeId, order++, depth + 1, maxDepth, maxNodes, window, ref count, ref visible, ref validRect, ref named);
                if (childData != null) node.Children.Add(childData);
                child = Safe(delegate { return TreeWalker.ControlViewWalker.GetNextSibling(child); }, null);
            }
            if (child != null) _treeTruncated = true;
            return node;
        }

        private static CoordinateRectData ConvertCoordinates(RectData screenRect, WindowData window)
        {
            if (screenRect == null || !screenRect.IsValid)
            {
                var invalid = new RectData { IsValid = false };
                return new CoordinateRectData { ScreenPhysicalPx = screenRect ?? invalid, ClientPhysicalPx = invalid, ClientDip = invalid, ClientNormalized = invalid };
            }
            double cx = screenRect.X - window.ClientRectScreenPhysicalPx.X;
            double cy = screenRect.Y - window.ClientRectScreenPhysicalPx.Y;
            var client = new RectData { X = cx, Y = cy, Width = screenRect.Width, Height = screenRect.Height, IsValid = true };
            double scaleX = 96.0 / window.DpiX;
            double scaleY = 96.0 / window.DpiY;
            var dip = new RectData { X = cx * scaleX, Y = cy * scaleY, Width = screenRect.Width * scaleX, Height = screenRect.Height * scaleY, IsValid = true };
            double width = window.ClientRectScreenPhysicalPx.Width;
            double height = window.ClientRectScreenPhysicalPx.Height;
            var normalized = new RectData { X = cx / width, Y = cy / height, Width = screenRect.Width / width, Height = screenRect.Height / height, IsValid = width > 0 && height > 0 };
            return new CoordinateRectData { ScreenPhysicalPx = screenRect, ClientPhysicalPx = client, ClientDip = dip, ClientNormalized = normalized };
        }

        private static List<string> ReadPatterns(AutomationElement element)
        {
            var result = new List<string>();
            try
            {
                foreach (AutomationPattern pattern in element.GetSupportedPatterns()) result.Add(PatternName(pattern.ProgrammaticName));
            }
            catch { }
            result.Sort(StringComparer.Ordinal);
            return result;
        }

        private static string ReadValue(AutomationElement element)
        {
            try
            {
                object pattern;
                if (element.TryGetCurrentPattern(ValuePattern.Pattern, out pattern))
                    return ((ValuePattern)pattern).Current.Value ?? "";
                if (element.TryGetCurrentPattern(SelectionPattern.Pattern, out pattern))
                {
                    AutomationElement[] selected = ((SelectionPattern)pattern).Current.GetSelection();
                    var names = new List<string>();
                    foreach (AutomationElement item in selected)
                    {
                        string name = Safe(delegate { return item.Current.Name; }, "");
                        if (!String.IsNullOrWhiteSpace(name)) names.Add(name);
                    }
                    return String.Join("; ", names.ToArray());
                }
            }
            catch { }
            return "";
        }

        private static string PatternName(string value)
        {
            if (String.IsNullOrEmpty(value)) return "";
            const string suffix = "PatternIdentifiers.Pattern";
            if (value.EndsWith(suffix, StringComparison.Ordinal)) return value.Substring(0, value.Length - suffix.Length);
            return TrimProgrammaticName(value);
        }

        private static bool IsClientUnobscured(IntPtr target, RectData rect)
        {
            int left = (int)rect.X;
            int top = (int)rect.Y;
            int right = (int)(rect.X + rect.Width - 1);
            int bottom = (int)(rect.Y + rect.Height - 1);
            Point[] points = new[]
            {
                new Point(left + Math.Min(10, Math.Max(0, right-left)), top + Math.Min(10, Math.Max(0, bottom-top))),
                new Point(right - Math.Min(10, Math.Max(0, right-left)), top + Math.Min(10, Math.Max(0, bottom-top))),
                new Point(left + Math.Min(10, Math.Max(0, right-left)), bottom - Math.Min(10, Math.Max(0, bottom-top))),
                new Point(right - Math.Min(10, Math.Max(0, right-left)), bottom - Math.Min(10, Math.Max(0, bottom-top))),
                new Point((left + right) / 2, (top + bottom) / 2)
            };
            foreach (Point point in points)
            {
                IntPtr hit = WindowFromPoint(point);
                if (GetAncestor(hit, GA_ROOT) != target) return false;
            }
            return true;
        }

        private static string ReadWindowTitle(IntPtr hWnd)
        {
            int length = GetWindowTextLength(hWnd);
            var builder = new StringBuilder(length + 1);
            GetWindowText(hWnd, builder, builder.Capacity);
            return builder.ToString();
        }

        private static RectData FromRect(RECT rect)
        {
            return new RectData { X = rect.Left, Y = rect.Top, Width = rect.Right - rect.Left, Height = rect.Bottom - rect.Top, IsValid = rect.Right > rect.Left && rect.Bottom > rect.Top };
        }

        private static string TrimProgrammaticName(string value)
        {
            if (String.IsNullOrEmpty(value)) return "";
            int dot = value.LastIndexOf('.');
            return dot >= 0 ? value.Substring(dot + 1) : value;
        }

        private static T Safe<T>(Func<T> action, T fallback)
        {
            try { return action(); } catch { return fallback; }
        }
    }
}
