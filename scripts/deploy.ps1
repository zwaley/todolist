# 项目部署自动化脚本 (PowerShell)
# 用于Windows环境的完整部署流程

param(
    [string]$Environment = "development",
    [switch]$SkipTests = $false,
    [switch]$Force = $false
)

# 设置错误处理
$ErrorActionPreference = "Stop"

# 颜色输出函数
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Write-Success { Write-ColorOutput Green $args }
function Write-Warning { Write-ColorOutput Yellow $args }
function Write-Error { Write-ColorOutput Red $args }
function Write-Info { Write-ColorOutput Cyan $args }

# 检查必要工具
function Test-Prerequisites {
    Write-Info "🔍 检查部署前置条件..."
    
    # 检查Node.js
    try {
        $nodeVersion = node --version
        Write-Success "✅ Node.js: $nodeVersion"
    } catch {
        Write-Error "❌ Node.js 未安装或不在PATH中"
        exit 1
    }
    
    # 检查npm
    try {
        $npmVersion = npm --version
        Write-Success "✅ npm: $npmVersion"
    } catch {
        Write-Error "❌ npm 未安装或不在PATH中"
        exit 1
    }
    
    # 检查Git
    try {
        $gitVersion = git --version
        Write-Success "✅ Git: $gitVersion"
    } catch {
        Write-Warning "⚠️ Git 未安装，无法进行版本控制操作"
    }
}

# 检查环境变量
function Test-Environment {
    Write-Info "🔧 检查环境变量配置..."
    
    if (-not (Test-Path ".env.local")) {
        if (Test-Path ".env.local.template") {
            Write-Warning "⚠️ .env.local 文件不存在"
            Write-Info "📋 请复制 .env.local.template 为 .env.local 并配置实际值"
            
            if (-not $Force) {
                $response = Read-Host "是否现在创建 .env.local 文件? (y/N)"
                if ($response -eq "y" -or $response -eq "Y") {
                    Copy-Item ".env.local.template" ".env.local"
                    Write-Success "✅ 已创建 .env.local 文件"
                    Write-Warning "⚠️ 请编辑 .env.local 文件并填入实际配置值"
                    Write-Info "📝 配置完成后重新运行部署脚本"
                    exit 0
                } else {
                    Write-Error "❌ 缺少环境变量配置文件"
                    exit 1
                }
            }
        } else {
            Write-Error "❌ 缺少环境变量模板文件"
            exit 1
        }
    }
    
    # 检查关键环境变量
    $envContent = Get-Content ".env.local" -Raw
    $requiredVars = @(
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
    
    foreach ($var in $requiredVars) {
        if ($envContent -notmatch "$var=.+") {
            Write-Error "❌ 缺少必需的环境变量: $var"
            exit 1
        }
    }
    
    Write-Success "✅ 环境变量配置检查通过"
}

# 安装依赖
function Install-Dependencies {
    Write-Info "📦 安装项目依赖..."
    
    if (-not (Test-Path "node_modules")) {
        Write-Info "首次安装依赖..."
        npm install
    } else {
        Write-Info "更新依赖..."
        npm ci
    }
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ 依赖安装失败"
        exit 1
    }
    
    Write-Success "✅ 依赖安装完成"
}

# 运行测试
function Invoke-Tests {
    if ($SkipTests) {
        Write-Warning "⏭️ 跳过测试"
        return
    }
    
    Write-Info "🧪 运行测试..."
    
    # 检查是否有测试文件
    if (-not (Test-Path "src/test") -and -not (Test-Path "__tests__")) {
        Write-Warning "⚠️ 未找到测试文件，跳过测试"
        return
    }
    
    npm run test
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ 测试失败"
        if (-not $Force) {
            exit 1
        } else {
            Write-Warning "⚠️ 强制模式：忽略测试失败"
        }
    } else {
        Write-Success "✅ 测试通过"
    }
}

# 构建项目
function Build-Project {
    Write-Info "🏗️ 构建项目..."
    
    npm run build
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error "❌ 构建失败"
        exit 1
    }
    
    Write-Success "✅ 构建完成"
}

# 数据库迁移检查
function Test-DatabaseMigrations {
    Write-Info "🗄️ 检查数据库迁移..."
    
    $migrationFiles = Get-ChildItem "db/migrations" -Filter "*.sql" -ErrorAction SilentlyContinue
    
    if ($migrationFiles.Count -eq 0) {
        Write-Warning "⚠️ 未找到数据库迁移文件"
        return
    }
    
    Write-Info "📋 发现以下迁移文件:"
    foreach ($file in $migrationFiles) {
        Write-Info "   - $($file.Name)"
    }
    
    Write-Warning "⚠️ 请确保在Supabase中执行了所有迁移文件"
    Write-Info "📝 迁移执行指南: docs/MIGRATION_EXECUTION_GUIDE.md"
}

# 启动开发服务器
function Start-DevServer {
    Write-Info "🚀 启动开发服务器..."
    
    # 检查端口是否被占用
    $port = 3002
    $portInUse = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    
    if ($portInUse) {
        Write-Warning "⚠️ 端口 $port 已被占用"
        $response = Read-Host "是否终止占用进程并继续? (y/N)"
        if ($response -eq "y" -or $response -eq "Y") {
            $process = Get-Process -Id $portInUse.OwningProcess -ErrorAction SilentlyContinue
            if ($process) {
                Stop-Process -Id $process.Id -Force
                Write-Success "✅ 已终止占用进程"
            }
        } else {
            Write-Info "📝 请手动处理端口占用问题"
            exit 0
        }
    }
    
    Write-Success "✅ 准备启动服务器..."
    Write-Info "🌐 应用将在 http://localhost:$port 启动"
    Write-Info "📝 按 Ctrl+C 停止服务器"
    
    npm run dev
}

# 生产部署
function Deploy-Production {
    Write-Info "🚀 准备生产部署..."
    
    # 构建项目
    Build-Project
    
    Write-Success "✅ 生产构建完成"
    Write-Info "📦 构建文件位于 .next 目录"
    Write-Info "📝 部署指南:"
    Write-Info "   1. 上传构建文件到服务器"
    Write-Info "   2. 配置环境变量"
    Write-Info "   3. 执行数据库迁移"
    Write-Info "   4. 启动应用: npm start"
}

# 主函数
function Main {
    Write-Info "🎯 开始部署流程 - 环境: $Environment"
    Write-Info "📅 时间: $(Get-Date)"
    Write-Info "📁 目录: $(Get-Location)"
    
    # 执行检查和部署步骤
    Test-Prerequisites
    Test-Environment
    Install-Dependencies
    Invoke-Tests
    Test-DatabaseMigrations
    
    switch ($Environment.ToLower()) {
        "development" {
            Start-DevServer
        }
        "production" {
            Deploy-Production
        }
        default {
            Write-Error "❌ 不支持的环境: $Environment"
            Write-Info "📝 支持的环境: development, production"
            exit 1
        }
    }
}

# 错误处理
trap {
    Write-Error "❌ 部署过程中发生错误: $_"
    Write-Info "📝 请检查错误信息并重试"
    exit 1
}

# 执行主函数
Main

# 脚本使用说明
<#
.SYNOPSIS
项目自动化部署脚本

.DESCRIPTION
此脚本用于自动化部署TodoList项目，包括环境检查、依赖安装、测试运行、构建和启动。

.PARAMETER Environment
部署环境，支持 'development' 或 'production'，默认为 'development'

.PARAMETER SkipTests
跳过测试步骤

.PARAMETER Force
强制模式，忽略某些错误继续执行

.EXAMPLE
.\scripts\deploy.ps1
使用默认设置部署开发环境

.EXAMPLE
.\scripts\deploy.ps1 -Environment production
部署生产环境

.EXAMPLE
.\scripts\deploy.ps1 -SkipTests -Force
跳过测试并强制执行
#>