#!/usr/bin/env node

/**
 * 代码质量快速检查脚本
 * 检查项目的基本代码质量指标
 */

const fs = require('fs');
const path = require('path');

class CodeQualityChecker {
  constructor() {
    this.issues = [];
    this.suggestions = [];
    this.score = 100;
  }

  // 检查文件是否存在
  checkFileExists(filePath, description) {
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${description}: 存在`);
      return true;
    } else {
      console.log(`❌ ${description}: 缺失`);
      this.issues.push(`缺少 ${description}`);
      this.score -= 5;
      return false;
    }
  }

  // 检查TypeScript配置
  checkTypeScriptConfig() {
    console.log('\n🔍 检查 TypeScript 配置...');
    
    const tsConfigExists = this.checkFileExists('tsconfig.json', 'TypeScript 配置文件');
    
    if (tsConfigExists) {
      try {
        const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'));
        
        // 检查严格模式
        if (tsConfig.compilerOptions?.strict) {
          console.log('✅ TypeScript 严格模式: 已启用');
        } else {
          console.log('⚠️ TypeScript 严格模式: 未启用');
          this.suggestions.push('启用 TypeScript 严格模式以提高类型安全');
          this.score -= 3;
        }
        
        // 检查路径映射
        if (tsConfig.compilerOptions?.paths) {
          console.log('✅ 路径映射: 已配置');
        } else {
          console.log('⚠️ 路径映射: 未配置');
          this.suggestions.push('配置路径映射以简化导入语句');
          this.score -= 2;
        }
      } catch (error) {
        console.log('❌ TypeScript 配置文件格式错误');
        this.issues.push('tsconfig.json 格式错误');
        this.score -= 5;
      }
    }
  }

  // 检查包管理配置
  checkPackageConfig() {
    console.log('\n📦 检查包管理配置...');
    
    const packageExists = this.checkFileExists('package.json', 'Package.json');
    
    if (packageExists) {
      try {
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        
        // 检查脚本
        const requiredScripts = ['dev', 'build', 'start'];
        const existingScripts = Object.keys(packageJson.scripts || {});
        
        requiredScripts.forEach(script => {
          if (existingScripts.includes(script)) {
            console.log(`✅ 脚本 "${script}": 存在`);
          } else {
            console.log(`❌ 脚本 "${script}": 缺失`);
            this.issues.push(`缺少 ${script} 脚本`);
            this.score -= 2;
          }
        });
        
        // 检查开发依赖
        const devDeps = packageJson.devDependencies || {};
        const recommendedDevDeps = ['typescript', '@types/node'];
        
        recommendedDevDeps.forEach(dep => {
          if (devDeps[dep]) {
            console.log(`✅ 开发依赖 "${dep}": 已安装`);
          } else {
            console.log(`⚠️ 开发依赖 "${dep}": 未安装`);
            this.suggestions.push(`安装 ${dep} 以改善开发体验`);
            this.score -= 1;
          }
        });
      } catch (error) {
        console.log('❌ Package.json 格式错误');
        this.issues.push('package.json 格式错误');
        this.score -= 5;
      }
    }
  }

  // 检查环境配置
  checkEnvironmentConfig() {
    console.log('\n🌍 检查环境配置...');
    
    const envLocalExists = this.checkFileExists('.env.local', '本地环境配置');
    const envExampleExists = this.checkFileExists('.env.example', '环境配置模板');
    
    if (envLocalExists) {
      try {
        const envContent = fs.readFileSync('.env.local', 'utf8');
        const requiredVars = [
          'NEXT_PUBLIC_SUPABASE_URL',
          'NEXT_PUBLIC_SUPABASE_ANON_KEY',
          'SUPABASE_SERVICE_ROLE_KEY'
        ];
        
        requiredVars.forEach(varName => {
          if (envContent.includes(varName)) {
            console.log(`✅ 环境变量 "${varName}": 已配置`);
          } else {
            console.log(`❌ 环境变量 "${varName}": 缺失`);
            this.issues.push(`缺少环境变量 ${varName}`);
            this.score -= 3;
          }
        });
      } catch (error) {
        console.log('❌ 无法读取 .env.local 文件');
        this.issues.push('环境配置文件读取失败');
        this.score -= 3;
      }
    }
    
    if (!envExampleExists) {
      this.suggestions.push('创建 .env.example 文件作为环境配置模板');
    }
  }

  // 检查代码结构
  checkCodeStructure() {
    console.log('\n🏗️ 检查代码结构...');
    
    const importantDirs = [
      { path: 'src', name: '源代码目录' },
      { path: 'src/app', name: 'App Router 目录' },
      { path: 'src/components', name: '组件目录' },
      { path: 'src/lib', name: '工具库目录' }
    ];
    
    importantDirs.forEach(dir => {
      if (fs.existsSync(dir.path) && fs.statSync(dir.path).isDirectory()) {
        console.log(`✅ ${dir.name}: 存在`);
      } else {
        console.log(`⚠️ ${dir.name}: 不存在`);
        this.suggestions.push(`创建 ${dir.path} 目录以改善代码组织`);
        this.score -= 2;
      }
    });
  }

  // 检查关键文件
  checkKeyFiles() {
    console.log('\n📄 检查关键文件...');
    
    const keyFiles = [
      { path: 'README.md', name: '项目说明文档', critical: false },
      { path: 'next.config.js', name: 'Next.js 配置', critical: false },
      { path: '.gitignore', name: 'Git 忽略文件', critical: true },
      { path: 'src/lib/supabase/client.ts', name: 'Supabase 客户端', critical: true }
    ];
    
    keyFiles.forEach(file => {
      const exists = this.checkFileExists(file.path, file.name);
      if (!exists && file.critical) {
        this.score -= 5;
      } else if (!exists) {
        this.score -= 2;
      }
    });
  }

  // 检查代码质量
  checkCodeQuality() {
    console.log('\n🔍 检查代码质量...');
    
    // 检查是否有 TypeScript 文件
    const srcDir = 'src';
    if (fs.existsSync(srcDir)) {
      const tsFiles = this.findFiles(srcDir, '.ts', '.tsx');
      console.log(`✅ TypeScript 文件数量: ${tsFiles.length}`);
      
      if (tsFiles.length === 0) {
        console.log('⚠️ 未发现 TypeScript 文件');
        this.suggestions.push('考虑将 JavaScript 文件迁移到 TypeScript');
        this.score -= 5;
      }
      
      // 检查是否有测试文件
      const testFiles = this.findFiles('.', '.test.', '.spec.');
      console.log(`📝 测试文件数量: ${testFiles.length}`);
      
      if (testFiles.length === 0) {
        console.log('⚠️ 未发现测试文件');
        this.suggestions.push('添加单元测试以提高代码质量');
        this.score -= 10;
      } else {
        console.log('✅ 已有测试文件');
      }
    }
  }

  // 查找文件
  findFiles(dir, ...extensions) {
    const files = [];
    
    if (!fs.existsSync(dir)) return files;
    
    const items = fs.readdirSync(dir);
    
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...this.findFiles(fullPath, ...extensions));
      } else if (stat.isFile()) {
        if (extensions.some(ext => item.includes(ext))) {
          files.push(fullPath);
        }
      }
    }
    
    return files;
  }

  // 生成报告
  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 代码质量评估报告');
    console.log('='.repeat(60));
    
    // 计算等级
    let grade = 'F';
    let gradeColor = '🔴';
    
    if (this.score >= 90) {
      grade = 'A';
      gradeColor = '🟢';
    } else if (this.score >= 80) {
      grade = 'B';
      gradeColor = '🟡';
    } else if (this.score >= 70) {
      grade = 'C';
      gradeColor = '🟠';
    } else if (this.score >= 60) {
      grade = 'D';
      gradeColor = '🔴';
    }
    
    console.log(`\n${gradeColor} 总体评分: ${this.score}/100 (等级: ${grade})`);
    
    if (this.issues.length > 0) {
      console.log('\n❌ 需要修复的问题:');
      this.issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }
    
    if (this.suggestions.length > 0) {
      console.log('\n💡 改进建议:');
      this.suggestions.forEach((suggestion, index) => {
        console.log(`   ${index + 1}. ${suggestion}`);
      });
    }
    
    console.log('\n🎯 下一步行动:');
    
    if (this.score < 70) {
      console.log('   1. 优先修复上述问题');
      console.log('   2. 执行 fix-missing-components.sql');
      console.log('   3. 运行 node verify-functions-only.js');
      console.log('   4. 参考 QUICK_START_IMPROVEMENTS.md');
    } else if (this.score < 90) {
      console.log('   1. 实施上述改进建议');
      console.log('   2. 添加更多测试覆盖');
      console.log('   3. 优化代码结构');
    } else {
      console.log('   1. 保持当前代码质量');
      console.log('   2. 定期运行此检查');
      console.log('   3. 考虑高级优化');
    }
    
    console.log('\n📚 相关文档:');
    console.log('   - CODE_QUALITY_IMPROVEMENTS.md (详细改进指南)');
    console.log('   - QUICK_START_IMPROVEMENTS.md (快速启动指南)');
    console.log('   - FUNCTION_CONFLICT_FIX.md (数据库修复指南)');
    
    console.log('\n' + '='.repeat(60));
  }

  // 运行所有检查
  async run() {
    console.log('🚀 开始代码质量检查...');
    console.log('检查时间:', new Date().toLocaleString());
    
    this.checkTypeScriptConfig();
    this.checkPackageConfig();
    this.checkEnvironmentConfig();
    this.checkCodeStructure();
    this.checkKeyFiles();
    this.checkCodeQuality();
    
    this.generateReport();
  }
}

// 运行检查
if (require.main === module) {
  const checker = new CodeQualityChecker();
  checker.run().catch(console.error);
}

module.exports = CodeQualityChecker;