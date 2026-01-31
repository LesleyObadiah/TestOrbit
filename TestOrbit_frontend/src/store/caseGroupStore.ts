import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getCaseGroupDetail } from '@/api/case/caseGroup'
import { ElMessage } from 'element-plus'
import type { CaseStep } from '@/api/case/caseStep/types'

// 定义用例组详细信息的类型
interface CaseGroupDetail {
  id: number
  name: string
  module_id: string
  steps: CaseStep[]
  // 添加其他可能的字段
  [key: string]: any
}

// 定义一个存储用例组详细数据的 store
export const useCaseGroupStore = defineStore('caseGroup', () => {
  // 🔥 核心状态：当前用例组的详细信息
  const caseGroupDetail = ref<CaseGroupDetail | null>(null)
  
  // 🔥 加载状态
  const loading = ref(false)
  
  // 🔥 错误状态
  const error = ref<string | null>(null)

  // 🔥 计算属性：步骤列表 - 支持读写
  const steps = computed({
    get: () => caseGroupDetail.value?.steps || [],
    set: (newSteps) => {
      if (caseGroupDetail.value) {
        caseGroupDetail.value.steps = newSteps
      }
    }
  })
  
  // 🔥 计算属性：用例组名称
  const caseGroupName = computed(() => caseGroupDetail.value?.name || '')
  
  // 🔥 计算属性：模块ID
  const moduleId = computed(() => caseGroupDetail.value?.module_id || '')

  // 🔥 Action：获取用例组详情
  async function fetchCaseGroupDetail(caseId: number) {
    if (!caseId) {
      console.warn('fetchCaseGroupDetail: caseId 为空')
      return
    }
    
    loading.value = true
    error.value = null
    
    try {
      const response = await getCaseGroupDetail(caseId)
      
      if (response.code === 200) {
        // 检查步骤数据完整性
        if (response.results && response.results.steps) {
          const stepsWithMissingNames = response.results.steps.filter(
            (step: any) => !step.step_name || step.step_name === ''
          )
          
          if (stepsWithMissingNames.length > 0) {
            console.warn(`⚠️ Store: 发现 ${stepsWithMissingNames.length} 个步骤缺少名称:`, 
              stepsWithMissingNames.map((s: any) => ({ id: s.step_id, order: s.step_order }))
            )
          }
        }
        
        // 更新 store 状态
        caseGroupDetail.value = response.results
        
        ElMessage.success(`成功加载用例组: ${response.results.name}`)
        return response.results
      } else {
        const errorMsg = response.msg || `加载用例组 #${caseId} 详情失败`
        error.value = errorMsg
        ElMessage.error(errorMsg)
        throw new Error(errorMsg)
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '获取用例组详情时发生未知错误'
      error.value = errorMsg
      console.error("Store: 获取用例组详情失败:", err)
      ElMessage.error("获取用例组详情时发生错误，请稍后重试")
      throw err
    } finally {
      loading.value = false
    }
  }

  // 🔥 Action：更新单个步骤
  function updateStep(stepId: number, updatedStepData: Partial<CaseStep>) {
    if (!caseGroupDetail.value?.steps) {
      console.warn('Store: updateStep 失败，steps 数据不存在')
      return
    }

    const stepIndex = caseGroupDetail.value.steps.findIndex(
      step => step.step_id === stepId || (step as any).id === stepId
    )
    
    if (stepIndex === -1) {
      console.warn(`Store: 未找到 stepId 为 ${stepId} 的步骤`)
      return
    }

    // 🔥 深度合并步骤数据
    const currentStep = caseGroupDetail.value.steps[stepIndex]
    const updatedStep = {
      ...currentStep,
      ...updatedStepData,
      // 确保关键字段正确设置
      step_id: stepId,
      // 智能合并 params
      params: {
        ...currentStep.params,
        ...updatedStepData.params
      },
      // 智能合并 assertions - 保持现有断言，除非明确提供新断言
      assertions: updatedStepData.assertions !== undefined 
        ? updatedStepData.assertions 
        : currentStep.assertions || []
    }

    // 🔥 更新 store 中的步骤数据
    caseGroupDetail.value.steps[stepIndex] = updatedStep

  }

  // 🔥 Action：添加新步骤
  function addNewStep() {
    if (!caseGroupDetail.value) {
      console.warn('Store: addNewStep 失败，caseGroupDetail 不存在')
      return
    }

    const currentStepsCount = caseGroupDetail.value.steps.length
    const newStepOrder = currentStepsCount + 1
    
    // 🔥 生成临时ID（负数）
    const tempId = -Date.now()
    
    const newStep: CaseStep = {
      step_id: tempId,
      step_name: `新步骤${newStepOrder}`,
      step_order: newStepOrder,
      type: 'api',
      enabled: true,
      status: 0,
      controller_data: null,
      retried_times: null,
      results: {
        message: null,
        request_log: {
          url: '',
          body: {},
          header: {},
          method: '',
          results: null,
          response: null,
          res_header: {},
          spend_time: 0
        }
      },
      params: {
        host: '',
        path: '/',
        method: 'GET',
        timeout: 30000,
        body_mode: 0,
        host_type: 0,
        query_mode: 0,
        body_source: {},
        expect_mode: 0,
        header_mode: 0,
        output_mode: 0,
        query_source: [],
        ban_redirects: false,
        expect_source: [],
        header_source: [],
        output_source: []
      },
      timeout: null,
      source: null,
      assertions: []
    }

    // 添加到 store
    caseGroupDetail.value.steps.push(newStep)

    return newStep
  }

  // Action：删除步骤
  function removeStep(stepId: number) {
    if (!caseGroupDetail.value?.steps) {
      return
    }

    const stepIndex = caseGroupDetail.value.steps.findIndex(
      step => step.step_id === stepId || (step as any).id === stepId
    )
    
    if (stepIndex === -1) {
      console.warn(`Store: 未找到 stepId 为 ${stepId} 的步骤`)
      return
    }

    // 🔥 从 store 中移除步骤
    const removedStep = caseGroupDetail.value.steps.splice(stepIndex, 1)[0]
    

    return removedStep
  }

  // 🔥 Action：清空数据
  function clearCaseGroupDetail() {
    caseGroupDetail.value = null
    error.value = null
  }

  // 🔥 Action：初始化新用例组
  function initNewCaseGroup(moduleId: string = '') {
    // 初始化一个空的用例组
    caseGroupDetail.value = {
      id: -1, // 使用临时ID
      name: '新建用例组',
      module_id: moduleId,
      steps: [],
      remark: null,
      latest_run_time: null,
      updated: new Date().toISOString(),
      module_related: [],
      only_show: false
    }
    
    
    return caseGroupDetail.value
  }

  // 🔥 Getter：根据ID获取步骤
  function getStepById(stepId: number) {
    return caseGroupDetail.value?.steps.find(
      step => step.step_id === stepId || (step as any).id === stepId
    )
  }

  return {
    // State
    caseGroupDetail,
    loading,
    error,
    
    // Computed
    steps,
    caseGroupName,
    moduleId,
    
    // Actions
    fetchCaseGroupDetail,
    updateStep,
    addNewStep,
    removeStep,
    clearCaseGroupDetail,
    initNewCaseGroup,
    
    // Getters
    getStepById
  }
})
