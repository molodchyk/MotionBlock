$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$OutputDirectory = Join-Path $Root "store-assets\promo"
if (-not (Test-Path -LiteralPath $OutputDirectory)) {
  New-Item -ItemType Directory -Path $OutputDirectory | Out-Null
}

function New-Color {
  param([int]$R, [int]$G, [int]$B, [int]$A = 255)
  return [System.Drawing.Color]::FromArgb($A, $R, $G, $B)
}

function New-Brush {
  param([System.Drawing.Color]$Color)
  return [System.Drawing.SolidBrush]::new($Color)
}

function New-Pen {
  param([System.Drawing.Color]$Color, [float]$Width = 1)
  return [System.Drawing.Pen]::new($Color, $Width)
}

function New-RoundedPath {
  param([float]$X, [float]$Y, [float]$W, [float]$H, [float]$R)

  $Path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $D = $R * 2
  $Path.AddArc($X, $Y, $D, $D, 180, 90)
  $Path.AddArc($X + $W - $D, $Y, $D, $D, 270, 90)
  $Path.AddArc($X + $W - $D, $Y + $H - $D, $D, $D, 0, 90)
  $Path.AddArc($X, $Y + $H - $D, $D, $D, 90, 90)
  $Path.CloseFigure()
  return $Path
}

function Fill-RoundedRect {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Brush]$Brush,
    [float]$X,
    [float]$Y,
    [float]$W,
    [float]$H,
    [float]$R
  )

  $Path = New-RoundedPath $X $Y $W $H $R
  $Graphics.FillPath($Brush, $Path)
  $Path.Dispose()
}

function Stroke-RoundedRect {
  param(
    [System.Drawing.Graphics]$Graphics,
    [System.Drawing.Pen]$Pen,
    [float]$X,
    [float]$Y,
    [float]$W,
    [float]$H,
    [float]$R
  )

  $Path = New-RoundedPath $X $Y $W $H $R
  $Graphics.DrawPath($Pen, $Path)
  $Path.Dispose()
}

function Draw-Text {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [System.Drawing.Font]$Font,
    [System.Drawing.Brush]$Brush,
    [float]$X,
    [float]$Y,
    [float]$W,
    [float]$H,
    [string]$Align = "Near"
  )

  $Format = [System.Drawing.StringFormat]::new()
  $Format.Alignment = [System.Drawing.StringAlignment]::$Align
  $Format.LineAlignment = [System.Drawing.StringAlignment]::Near
  $Format.Trimming = [System.Drawing.StringTrimming]::EllipsisWord
  $Graphics.DrawString($Text, $Font, $Brush, [System.Drawing.RectangleF]::new($X, $Y, $W, $H), $Format)
  $Format.Dispose()
}

function Draw-Icon {
  param(
    [System.Drawing.Graphics]$Graphics,
    [float]$X,
    [float]$Y,
    [float]$Size
  )

  $Bg = New-Brush (New-Color 24 59 69)
  $Circle = New-Brush (New-Color 244 246 242)
  $Play = New-Brush (New-Color 47 119 84)
  $Strike = New-Pen (New-Color 182 70 63) ([Math]::Max(4, $Size * 0.11))
  $StrikeInner = New-Pen (New-Color 244 246 242) ([Math]::Max(2, $Size * 0.045))
  $Strike.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $Strike.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $StrikeInner.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $StrikeInner.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

  Fill-RoundedRect $Graphics $Bg $X $Y $Size $Size ($Size * 0.18)
  $Graphics.FillEllipse($Circle, $X + $Size * 0.21, $Y + $Size * 0.21, $Size * 0.58, $Size * 0.58)

  $Points = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($X + $Size * 0.38, $Y + $Size * 0.32),
    [System.Drawing.PointF]::new($X + $Size * 0.38, $Y + $Size * 0.68),
    [System.Drawing.PointF]::new($X + $Size * 0.69, $Y + $Size * 0.5)
  )
  $Path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $Path.AddPolygon($Points)
  $Graphics.FillPath($Play, $Path)
  $Path.Dispose()

  $Graphics.DrawLine($Strike, $X + $Size * 0.24, $Y + $Size * 0.76, $X + $Size * 0.76, $Y + $Size * 0.24)
  $Graphics.DrawLine($StrikeInner, $X + $Size * 0.24, $Y + $Size * 0.76, $X + $Size * 0.76, $Y + $Size * 0.24)

  $StrikeInner.Dispose()
  $Strike.Dispose()
  $Play.Dispose()
  $Circle.Dispose()
  $Bg.Dispose()
}

function Draw-FeaturePill {
  param(
    [System.Drawing.Graphics]$Graphics,
    [string]$Text,
    [float]$X,
    [float]$Y,
    [float]$W
  )

  $Fill = New-Brush (New-Color 244 246 242)
  $Border = New-Pen (New-Color 128 153 145)
  $TextBrush = New-Brush (New-Color 24 59 69)
  $Font = [System.Drawing.Font]::new("Segoe UI", 18, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

  Fill-RoundedRect $Graphics $Fill $X $Y $W 38 8
  Stroke-RoundedRect $Graphics $Border $X $Y $W 38 8
  Draw-Text $Graphics $Text $Font $TextBrush ($X + 14) ($Y + 8) ($W - 28) 24

  $Font.Dispose()
  $TextBrush.Dispose()
  $Border.Dispose()
  $Fill.Dispose()
}

function New-PromoCanvas {
  param([int]$Width, [int]$Height)

  $Bitmap = [System.Drawing.Bitmap]::new($Width, $Height)
  $Graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::ClearTypeGridFit
  return @{ Bitmap = $Bitmap; Graphics = $Graphics }
}

function Save-Promo {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [string]$FileName
  )

  $Path = Join-Path $OutputDirectory $FileName
  $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host "Created $Path"
}

function Draw-SmallPromo {
  $Canvas = New-PromoCanvas 440 280
  $Bitmap = $Canvas.Bitmap
  $Graphics = $Canvas.Graphics
  $Background = New-Brush (New-Color 14 20 24)
  $Panel = New-Brush (New-Color 21 29 34)
  $Text = New-Brush (New-Color 244 246 242)
  $Muted = New-Brush (New-Color 188 202 195)
  $Accent = New-Brush (New-Color 47 119 84)
  $TitleFont = [System.Drawing.Font]::new("Segoe UI", 34, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $BodyFont = [System.Drawing.Font]::new("Segoe UI", 19, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $SmallFont = [System.Drawing.Font]::new("Segoe UI", 16, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

  $Graphics.FillRectangle($Background, 0, 0, 440, 280)
  Fill-RoundedRect $Graphics $Panel 24 24 392 232 14
  Draw-Icon $Graphics 304 44 82
  Draw-Text $Graphics "MotionBlock" $TitleFont $Text 48 42 240 46
  Draw-Text $Graphics "Stop GIFs, autoplay, and distracting motion." $BodyFont $Muted 50 94 230 62
  $Graphics.FillRectangle($Accent, 50, 166, 260, 4)
  Draw-Text $Graphics "Per-site controls" $SmallFont $Text 50 184 170 28
  Draw-Text $Graphics "GIFV + video previews" $SmallFont $Text 50 214 210 28

  Save-Promo $Bitmap "small-promo-440x280.png"

  $SmallFont.Dispose()
  $BodyFont.Dispose()
  $TitleFont.Dispose()
  $Accent.Dispose()
  $Muted.Dispose()
  $Text.Dispose()
  $Panel.Dispose()
  $Background.Dispose()
  $Graphics.Dispose()
  $Bitmap.Dispose()
}

function Draw-MarqueePromo {
  $Canvas = New-PromoCanvas 1400 560
  $Bitmap = $Canvas.Bitmap
  $Graphics = $Canvas.Graphics
  $Background = New-Brush (New-Color 14 20 24)
  $Panel = New-Brush (New-Color 21 29 34)
  $Text = New-Brush (New-Color 244 246 242)
  $Muted = New-Brush (New-Color 188 202 195)
  $Accent = New-Brush (New-Color 47 119 84)
  $MutedPanel = New-Brush (New-Color 239 244 240)
  $Placeholder = New-Brush (New-Color 213 225 221)
  $PlaceholderLine = New-Pen (New-Color 185 203 197) 9
  $CardText = New-Brush (New-Color 24 37 34)
  $TitleFont = [System.Drawing.Font]::new("Segoe UI", 62, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $BodyFont = [System.Drawing.Font]::new("Segoe UI", 28, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
  $PillFont = [System.Drawing.Font]::new("Segoe UI", 22, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $CardFont = [System.Drawing.Font]::new("Segoe UI", 24, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)

  $Graphics.FillRectangle($Background, 0, 0, 1400, 560)
  Fill-RoundedRect $Graphics $Panel 64 58 1272 444 22
  Draw-Icon $Graphics 1056 96 142

  Draw-Text $Graphics "MotionBlock" $TitleFont $Text 112 104 520 82
  Draw-Text $Graphics "GIF, animation, and autoplay blocker with per-site rules." $BodyFont $Muted 116 196 650 82

  Draw-FeaturePill $Graphics "GIFs" 116 316 118
  Draw-FeaturePill $Graphics "GIFV" 252 316 118
  Draw-FeaturePill $Graphics "Autoplay" 388 316 164
  Draw-FeaturePill $Graphics "Video" 570 316 132
  Draw-FeaturePill $Graphics "Images" 720 316 138

  Fill-RoundedRect $Graphics $MutedPanel 902 290 330 154 14
  Draw-Text $Graphics "Blocked preview" $CardFont $CardText 930 318 230 34
  Fill-RoundedRect $Graphics $Placeholder 930 366 250 42 8
  $Graphics.DrawLine($PlaceholderLine, 940, 388, 1170, 388)
  $Graphics.FillRectangle($Accent, 930, 424, 210, 6)

  Save-Promo $Bitmap "marquee-promo-1400x560.png"

  $CardFont.Dispose()
  $PillFont.Dispose()
  $BodyFont.Dispose()
  $TitleFont.Dispose()
  $CardText.Dispose()
  $PlaceholderLine.Dispose()
  $Placeholder.Dispose()
  $MutedPanel.Dispose()
  $Accent.Dispose()
  $Muted.Dispose()
  $Text.Dispose()
  $Panel.Dispose()
  $Background.Dispose()
  $Graphics.Dispose()
  $Bitmap.Dispose()
}

Draw-SmallPromo
Draw-MarqueePromo
