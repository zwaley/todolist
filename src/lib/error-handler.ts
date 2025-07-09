// 错误处理工具库
// 提供统一的错误处理、日志记录和用户友好的错误消息生成

export interface DetailedError {
  timestamp: string
  context: string
  error: {
    message?: string
    code?: string
    details?: string
    hint?: string
    status?: number
    statusText?: string
  }
  additionalInfo?: any
  stack?: string
}

// 详细错误日志记录函数
export function logDetailedError(context: string, error: any, additionalInfo?: any): DetailedError {
  const timestamp = new Date().toISOString()
  const errorDetails: DetailedError = {
    timestamp,
    context,
    error: {
      message: error?.message,
      code: error?.code,
      details: error?.details,
      hint: error?.hint,
      status: error?.status,
      statusText: error?.statusText,
    },
    additionalInfo,
    stack: error?.stack
  }
  
  console.error('=== 详细错误报告 ===', JSON.stringify(errorDetails, null, 2))
  return errorDetails
}

// 生成用户友好的错误消息
export function generateUserFriendlyErrorMessage(context: string, error: any): string {
  const baseMessage = `${context}失败`
  const errorCode = error?.code ? ` (错误代码: ${error.code})` : ''
  const errorMessage = error?.message ? ` - ${error.message}` : ''
  const errorHint = error?.hint ? ` 提示: ${error.hint}` : ''
  
  return `${baseMessage}${errorCode}${errorMessage}${errorHint}`
}

// 生成开发者详细错误消息（包含更多技术细节）
export function generateDeveloperErrorMessage(context: string, error: any): string {
  const timestamp = new Date().toISOString()
  const parts = [
    `[${timestamp}] ${context}失败`,
    error?.code ? `错误代码: ${error.code}` : null,
    error?.message ? `消息: ${error.message}` : null,
    error?.details ? `详情: ${error.details}` : null,
    error?.hint ? `提示: ${error.hint}` : null,
    error?.status ? `HTTP状态: ${error.status}` : null,
  ].filter(Boolean)
  
  return parts.join(' | ')
}

// 错误类型分类
export enum ErrorType {
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization', 
  VALIDATION = 'validation',
  DATABASE = 'database',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}

// 根据错误特征分类错误类型
export function classifyError(error: any): ErrorType {
  if (!error) return ErrorType.UNKNOWN
  
  // 认证错误
  if (error.status === 401 || error.message?.includes('auth') || error.code === 'PGRST301') {
    return ErrorType.AUTHENTICATION
  }
  
  // 授权错误
  if (error.status === 403 || error.message?.includes('permission') || error.code === 'PGRST116') {
    return ErrorType.AUTHORIZATION
  }
  
  // 数据库错误
  if (error.code?.startsWith('23') || error.code?.startsWith('42') || error.code?.startsWith('P')) {
    return ErrorType.DATABASE
  }
  
  // 验证错误
  if (error.status === 400 || error.message?.includes('validation')) {
    return ErrorType.VALIDATION
  }
  
  // 网络错误
  if (error.status >= 500 || error.message?.includes('network') || error.message?.includes('fetch')) {
    return ErrorType.NETWORK
  }
  
  return ErrorType.UNKNOWN
}

// 根据错误类型生成建议的解决方案
export function generateErrorSolution(errorType: ErrorType, error: any): string {
  switch (errorType) {
    case ErrorType.AUTHENTICATION:
      return '请重新登录或检查您的登录凭据'
    case ErrorType.AUTHORIZATION:
      return '您没有执行此操作的权限，请联系管理员'
    case ErrorType.VALIDATION:
      return '请检查输入的数据格式是否正确'
    case ErrorType.DATABASE:
      if (error.code === '23505') {
        return '数据已存在，请使用不同的值'
      }
      if (error.code === '23503') {
        return '引用的数据不存在，请检查关联数据'
      }
      if (error.code === '42703') {
        return '数据库结构问题，请联系技术支持'
      }
      return '数据库操作失败，请稍后重试'
    case ErrorType.NETWORK:
      return '网络连接问题，请检查网络连接后重试'
    default:
      return '发生未知错误，请稍后重试或联系技术支持'
  }
}

// 综合错误处理函数
export function handleError(context: string, error: any, additionalInfo?: any) {
  // 记录详细错误
  const errorDetails = logDetailedError(context, error, additionalInfo)
  
  // 分类错误
  const errorType = classifyError(error)
  
  // 生成用户友好消息
  const userMessage = generateUserFriendlyErrorMessage(context, error)
  
  // 生成解决方案
  const solution = generateErrorSolution(errorType, error)
  
  // 生成开发者消息
  const developerMessage = generateDeveloperErrorMessage(context, error)
  
  return {
    errorDetails,
    errorType,
    userMessage,
    solution,
    developerMessage,
    fullMessage: `${userMessage} | ${solution}`
  }
}