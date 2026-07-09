// 动作注册表:业务模块注册命名动作,调度器按 module+action 派发。
// 本文件不 import 任何业务模块,避免循环依赖。
const actions = new Map()

export function register(module, action, fn) {
  actions.set(`${module}:${action}`, fn)
}

export function has(module, action) {
  return actions.has(`${module}:${action}`)
}

export function dispatch(module, action, params) {
  const fn = actions.get(`${module}:${action}`)
  if (!fn) throw new Error(`未注册的动作: ${module}.${action}`)
  return fn(params || {})
}
