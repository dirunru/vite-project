<template>
  <div class="table-container">
    <!-- 添加操作按钮 -->
    <div class="toolbar">
      <el-button 
        type="danger" 
        :disabled="selectedIds.size === 0"
        @click="handleDeleteSelected"
      >
        批量删除
      </el-button>
      <span v-if="selectedIds.size > 0" class="selection-info">
        已选择 {{ selectedIds.size }} 项
      </span>
    </div>
    
    <el-table
      :data="paginatedData"
      style="width: 100%"
      v-loading="loading"
      @select="handleSelectionChange"
      @select-all="handleSelectAll"
      row-key="id"
      ref="tableRef"
    >
      <!-- 添加多选列 -->
      <el-table-column
        type="selection"
        width="55"
        align="center"
      />
      
      <el-table-column
        prop="id"
        label="ID"
        width="80"
      />
      <el-table-column
        prop="name"
        label="姓名"
        width="120"
      />
      <el-table-column
        prop="age"
        label="年龄"
        width="80"
      />
      <el-table-column
        prop="email"
        label="邮箱"
      />
      <el-table-column
        prop="address"
        label="地址"
      />
      <el-table-column
        prop="createTime"
        label="创建时间"
        width="180"
      />
    </el-table>

    <el-pagination
      @size-change="handleSizeChange"
      @current-change="handleCurrentChange"
      :current-page="currentPage"
      :page-sizes="[10, 20, 50, 100]"
      :page-size="pageSize"
      layout="total, sizes, prev, pager, next, jumper"
      :total="total"
      background
      style="margin-top: 20px; text-align: right;"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue'
import type { TableInstance } from 'element-plus'

// 定义数据类型
interface User {
  id: number
  name: string
  age: number
  email: string
  address: string
  createTime: string
}

// 定义响应式数据
const tableData = ref<User[]>([])
const currentPage = ref(1)
const pageSize = ref(10)
const total = ref(100)
const loading = ref(false)
const tableRef = ref<TableInstance>()

// 存储所有已选择的ID（跨页面）
const selectedIds = ref<Set<number>>(new Set())

// 计算分页数据
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return tableData.value.slice(start, end)
})

// 处理多选变化
const handleSelectionChange = (selection: User[], row: User) => {
  // console.log('selection', selection, row, 'row')
  if (selectedIds.value.has(row.id)) {
    selectedIds.value.delete(row.id)
    tableRef.value?.toggleRowSelection(row, false)
  } else {
    selectedIds.value.add(row.id)
    tableRef.value?.toggleRowSelection(row, true)
  }
}

// 处理全选事件
const handleSelectAll = (selection: User[]) => {
  console.log('selection', selection)
  if (selection.length > 0) {
    tableData.value.forEach(item => {
      selectedIds.value.add(item.id)
    })
  } else {
    tableData.value.forEach(item => {
      selectedIds.value.delete(item.id)
    })
  }
}

// 模拟数据生成函数
const generateMockData = (count: number): User[] => {
  const data: User[] = []
  for (let i = 1; i <= count; i++) {
    data.push({
      id: i,
      name: `用户${i}`,
      age: Math.floor(Math.random() * 50) + 18,
      email: `user${i}@example.com`,
      address: `北京市朝阳区街道${i}号`,
      createTime: new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toLocaleDateString()
    })
  }
  return data
}

// 更新当前页面的选中状态
const updateCurrentPageSelection = () => {
  nextTick(() => {
    paginatedData.value.forEach(item => {
      if (selectedIds.value.has(item.id)) {
        tableRef.value?.toggleRowSelection(item, true)
      } else {
        tableRef.value?.toggleRowSelection(item, false)
      }
    })
  })
}

// 获取表格数据
const getTableData = () => {
  loading.value = true
  // 模拟请求延迟
  setTimeout(() => {
    // 一次性生成所有数据
    tableData.value = generateMockData(total.value)
    // 恢复之前选中的行状态
    updateCurrentPageSelection()
    loading.value = false
  }, 300)
}

// 分页大小改变
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
  updateCurrentPageSelection()
}

// 当前页改变
const handleCurrentChange = (val: number) => {
  currentPage.value = val
  updateCurrentPageSelection()
}

// 批量删除
const handleDeleteSelected = () => {}

// 初始化加载数据
onMounted(() => {
  getTableData()
})
</script>

<style scoped>
.table-container {
  padding: 20px;
}

.toolbar {
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.selection-info {
  color: #606266;
  font-size: 14px;
}
</style>