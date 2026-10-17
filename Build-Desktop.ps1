param([string]$Python='python',[string]$ModelRoot,[string]$BuildName='desktop-build')
$ErrorActionPreference='Stop'
if(-not $ModelRoot){$ModelRoot=Join-Path $PSScriptRoot 'lrc-maker\models'}
foreach($name in @('base.en','small.en')){if(-not(Test-Path -LiteralPath (Join-Path $ModelRoot ($name+'\model.bin')))){throw "Missing $name. Run lrc-maker/download_models.py first, or pass -ModelRoot."}}
$manifest=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'lrc-maker\model-manifest.json') -Raw|ConvertFrom-Json
foreach($model in $manifest.PSObject.Properties){foreach($file in $model.Value.files.PSObject.Properties){$path=Join-Path $ModelRoot ($model.Name+'\'+$file.Name);if((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ne $file.Value){throw "Model checksum mismatch: $path"}}}
& $Python -m PyInstaller --noconfirm --distpath (Join-Path $PSScriptRoot ('dist\'+$BuildName)) --workpath (Join-Path $PSScriptRoot 'dist\desktop-work') (Join-Path $PSScriptRoot 'desktop\MyifyDesktop.spec')
if($LASTEXITCODE-ne 0){throw 'Desktop tools build failed.'}
$destination=Join-Path $PSScriptRoot ('dist\'+$BuildName+'\MyifyDesktop')
[IO.Directory]::CreateDirectory((Join-Path $destination 'models'))|Out-Null
foreach($name in @('base.en','small.en')){Copy-Item -LiteralPath (Join-Path $ModelRoot $name) -Destination (Join-Path $destination 'models') -Recurse -Force}
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'lrc-maker\third-party-licenses') -Destination $destination -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'desktop\LICENSE') -Destination (Join-Path $destination 'LICENSE') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'desktop\THIRD-PARTY-NOTICES.txt') -Destination $destination -Force
Write-Output $destination
