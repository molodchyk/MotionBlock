$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$IconDirectory = Join-Path $Root "assets\icons"
$Sizes = @(16, 32, 48, 128)

foreach ($Size in $Sizes) {
  $Bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.Clear([System.Drawing.Color]::Transparent)

  $Scale = $Size / 128
  $Rect = New-Object System.Drawing.RectangleF 0, 0, $Size, $Size
  $Background = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(24, 59, 69))
  $Foreground = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(244, 246, 242))
  $Play = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(47, 119, 84))
  $Strike = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(182, 70, 63)), ([Math]::Max(2, 14 * $Scale))
  $Strike.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $Strike.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $Strike.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $StrikeInner = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(244, 246, 242)), ([Math]::Max(1, 6 * $Scale))
  $StrikeInner.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $StrikeInner.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  $Graphics.FillRectangle($Background, $Rect)
  $Graphics.FillEllipse($Foreground, 26 * $Scale, 26 * $Scale, 76 * $Scale, 76 * $Scale)

  $PlayPath = New-Object System.Drawing.Drawing2D.GraphicsPath
  $PlayPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(47 * $Scale, 41 * $Scale),
    [System.Drawing.PointF]::new(47 * $Scale, 87 * $Scale),
    [System.Drawing.PointF]::new(86 * $Scale, 64 * $Scale)
  )
  $PlayPath.AddPolygon($PlayPoints)
  $Graphics.FillPath($Play, $PlayPath)

  $Graphics.DrawLine($Strike, 31 * $Scale, 96 * $Scale, 96 * $Scale, 31 * $Scale)
  $Graphics.DrawLine($StrikeInner, 31 * $Scale, 96 * $Scale, 96 * $Scale, 31 * $Scale)

  $Path = Join-Path $IconDirectory ("icon-" + $Size + ".png")
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)

  $PlayPath.Dispose()
  $StrikeInner.Dispose()
  $Strike.Dispose()
  $Play.Dispose()
  $Foreground.Dispose()
  $Background.Dispose()
  $Graphics.Dispose()
  $Bitmap.Dispose()
}

Write-Host "Generated MotionBlock icons."
