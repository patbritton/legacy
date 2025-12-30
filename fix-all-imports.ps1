# Fix all import paths after moving from /legacy/ to root

Write-Host "Fixing lib imports in subdirectories..."

# Fix admin directory (1 level deep - needs ../../lib/)
Get-ChildItem -Path "src/pages/admin" -Include "*.astro","*.ts" -Recurse | ForEach-Object {
    (Get-Content $_.FullName) -replace 'from "\.\./lib/', 'from "../../lib/' | Set-Content $_.FullName
}

# Fix guestbook directory (1 level deep - needs ../../lib/)
Get-ChildItem -Path "src/pages/guestbook" -Include "*.astro" -Recurse | ForEach-Object {
    (Get-Content $_.FullName) -replace 'from "\.\./lib/', 'from "../../lib/' | Set-Content $_.FullName
}

# Fix exposure directory (1 level deep - needs ../../lib/)
Get-ChildItem -Path "src/pages/exposure" -Include "*.astro" -Recurse | ForEach-Object {
    (Get-Content $_.FullName) -replace 'from "\.\./lib/', 'from "../../lib/' | Set-Content $_.FullName
}

# Fix kid directory - only top level files (1 level deep - needs ../../lib/)
Get-ChildItem -Path "src/pages/kid" -Include "*.astro" -File | ForEach-Object {
    (Get-Content $_.FullName) -replace 'from "\.\./lib/', 'from "../../lib/' | Set-Content $_.FullName
}

# Fix news directory (1 level deep - needs ../../lib/)
if (Test-Path "src/pages/news") {
    Get-ChildItem -Path "src/pages/news" -Include "*.astro" -Recurse | ForEach-Object {
        (Get-Content $_.FullName) -replace 'from "\.\./lib/', 'from "../../lib/' | Set-Content $_.FullName
    }
}

# Fix politics directory (1 level deep - needs ../../lib/)
if (Test-Path "src/pages/politics") {
    Get-ChildItem -Path "src/pages/politics" -Include "*.astro" -Recurse | ForEach-Object {
        (Get-Content $_.FullName) -replace 'from "\.\./lib/', 'from "../../lib/' | Set-Content $_.FullName
    }
}

Write-Host "Import paths fixed! Now push to GitHub and deploy on VPS."
