# TodoList 开发环境快速设置脚本
# 适用于 Windows PowerShell
# 作用：帮助新开发者快速搭建完整的开发环境

Write-Host "🚀 TodoList 开发环境设置开始..." -ForegroundColor Green
Write-Host ""

# 检查必要的工具
function Test-Command {
    param($Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    } catch {
        return $false
    }
}

# 1. 检查 Node.js
Write-Host "📋 检查开发环境依赖..." -ForegroundColor Yellow
if (Test-Command "node") {
    $nodeVersion = node --version
    Write-Host "✅ Node.js 已安装: $nodeVersion" -ForegroundColor Green
} else {
    Write-Host "❌ Node.js 未安装，请先安装 Node.js 18+ 版本" -ForegroundColor Red
    Write-Host "   下载地址: https://nodejs.org/" -ForegroundColor Cyan
    exit 1
}

# 2. 检查 npm
if (Test-Command "npm") {
    $npmVersion = npm --version
    Write-Host "✅ npm 已安装: $npmVersion" -ForegroundColor Green
} else {
    Write-Host "❌ npm 未安装" -ForegroundColor Red
    exit 1
}

# 3. 检查 Git
if (Test-Command "git") {
    Write-Host "✅ Git 已安装" -ForegroundColor Green
} else {
    Write-Host "❌ Git 未安装，请先安装 Git" -ForegroundColor Red
    Write-Host "   下载地址: https://git-scm.com/" -ForegroundColor Cyan
    exit 1
}

Write-Host ""

# 4. 安装项目依赖
Write-Host "📦 安装项目依赖..." -ForegroundColor Yellow
if (Test-Path "package.json") {
    try {
        npm install
        Write-Host "✅ 依赖安装成功" -ForegroundColor Green
    } catch {
        Write-Host "❌ 依赖安装失败" -ForegroundColor Red
        Write-Host "   请检查网络连接或尝试: npm install --registry https://registry.npmmirror.com" -ForegroundColor Cyan
        exit 1
    }
} else {
    Write-Host "❌ 未找到 package.json 文件" -ForegroundColor Red
    Write-Host "   请确保在项目根目录执行此脚本" -ForegroundColor Cyan
    exit 1
}

Write-Host ""

# 5. 检查环境变量文件
Write-Host "🔧 检查环境配置..." -ForegroundColor Yellow
if (Test-Path ".env.local") {
    Write-Host "✅ .env.local 文件已存在" -ForegroundColor Green
} else {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env.local"
        Write-Host "✅ 已从 .env.example 创建 .env.local" -ForegroundColor Green
        Write-Host "⚠️  请编辑 .env.local 文件，配置你的 Supabase 连接信息" -ForegroundColor Yellow
    } else {
        Write-Host "⚠️  未找到环境变量模板文件" -ForegroundColor Yellow
        Write-Host "   请手动创建 .env.local 文件并配置 Supabase 连接信息" -ForegroundColor Cyan
    }
}

Write-Host ""

# 6. 数据库设置指导
Write-Host "🗄️  数据库设置指导" -ForegroundColor Yellow
Write-Host "   1. 确保你已经创建了 Supabase 项目" -ForegroundColor Cyan
Write-Host "   2. 获取项目的 URL 和 anon key" -ForegroundColor Cyan
Write-Host "   3. 在 .env.local 中配置连接信息" -ForegroundColor Cyan
Write-Host "   4. 根据数据库状态选择初始化方式:" -ForegroundColor Cyan
Write-Host ""
Write-Host "   新项目 (空数据库):" -ForegroundColor White
Write-Host "   - 执行: db/init/00_initial_setup.sql" -ForegroundColor Gray
Write-Host ""
Write-Host "   现有项目 (已有数据):" -ForegroundColor White
Write-Host "   - 按顺序执行 db/migrations/ 中的迁移文件" -ForegroundColor Gray
Write-Host "   - 参考: docs/MIGRATION_EXECUTION_ORDER.md" -ForegroundColor Gray
Write-Host ""

# 7. 开发工具推荐
Write-Host "🛠️  推荐开发工具" -ForegroundColor Yellow
Write-Host "   - VS Code (推荐扩展: ES7+ React/Redux/React-Native snippets)" -ForegroundColor Cyan
Write-Host "   - Supabase CLI (可选): npm install -g @supabase/cli" -ForegroundColor Cyan
Write-Host "   - Postman 或类似工具用于 API 测试" -ForegroundColor Cyan
Write-Host ""

# 8. 启动开发服务器
Write-Host "🚀 准备启动开发服务器..." -ForegroundColor Yellow
$startServer = Read-Host "是否现在启动开发服务器? (y/N)"
if ($startServer -eq "y" -or $startServer -eq "Y") {
    Write-Host "启动开发服务器..." -ForegroundColor Green
    Write-Host "访问地址: http://localhost:3000" -ForegroundColor Cyan
    Write-Host "按 Ctrl+C 停止服务器" -ForegroundColor Cyan
    Write-Host ""
    npm run dev
} else {
    Write-Host ""
    Write-Host "✅ 开发环境设置完成!" -ForegroundColor Green
    Write-Host ""
    Write-Host "下一步操作:" -ForegroundColor Yellow
    Write-Host "1. 配置 .env.local 文件" -ForegroundColor Cyan
    Write-Host "2. 初始化数据库 (参考 db/README.md)" -ForegroundColor Cyan
    Write-Host "3. 启动开发服务器: npm run dev" -ForegroundColor Cyan
    Write-Host "4. 访问 http://localhost:3000" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📚 更多信息:" -ForegroundColor Yellow
    Write-Host "- 项目文档: README.md" -ForegroundColor Cyan
    Write-Host "- 贡献指南: CONTRIBUTING.md" -ForegroundColor Cyan
    Write-Host "- 数据库文档: docs/" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "🎉 欢迎加入 TodoList 项目开发!" -ForegroundColor Green