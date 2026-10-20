<template>
  <div>
    <el-table
      :data="paginatedData"
      border
      stripe
      style="width: 100%"
      @row-click="toggleRow"
    >
      <!-- 选择列 -->
      <el-table-column label="选择" min-width="60">
        <template #default="scope">
          <slot
            name="selection"
            :row="scope.row"
            :selected="selectedIds.has(scope.row[idField])"
          >
            <template v-if="displayType === 'radio'">
              <el-radio
                :model-value="selectedIds.has(scope.row[idField])"
                :label="true"
                @change="toggleRow(scope.row)"
              >
                {{ scope.row[idField] }}
              </el-radio>
            </template>

            <template v-else>
              <el-checkbox
                :model-value="selectedIds.has(scope.row[idField])"
                @change="toggleRow(scope.row)"
              />
            </template>
          </slot>
        </template>
      </el-table-column>

      <!-- 自定义列 -->
      <el-table-column
        v-for="col in columns"
        :key="col.prop || col.label"
        v-bind="col"
      >
        <template #default="scope">
          <slot :name="col.prop" :row="scope.row" :value="scope.row[col.prop]">
            {{ scope.row[col.prop] }}
          </slot>
        </template>
      </el-table-column>
    </el-table>

    <!-- 分页 -->
    <el-pagination
      style="margin-top: 16px; text-align: right;"
      background
      layout="prev, pager, next"
      :page-size="pageSize"
      :current-page="currentPage"
      :total="tableData.length"
      @current-change="handlePageChange"
    >
    </el-pagination>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch, defineProps, defineEmits, computed } from 'vue';

interface RowItem {
  [key: string]: any;
}

interface Column {
  label: string;
  prop?: string;
  width?: string | number;
  align?: string;
  [key: string]: any;
}

const props = defineProps<{
  data: RowItem[];
  columns: Column[];
  displayType?: 'radio' | 'checkbox';
  idField?: string;
  defaultSelected?: Array<string | number>;
  pageSize?: {
    type: Number;
    default: 10;
  };
}>();

const emits = defineEmits<{
  (e: 'select', selectedRows: RowItem[]): void;
}>();

const tableData = ref<RowItem[]>(props.data);
const displayType = props.displayType ?? 'checkbox';
const idField = props.idField ?? 'value';
const pageSize = props.pageSize ?? 10;

const selectedIds = ref<Set<string | number>>(new Set(props.defaultSelected || []));
const currentPage = ref(1);

// 当前页数据
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize;
  return tableData.value.slice(start, start + pageSize);
});

// 点击行切换选中
const toggleRow = (row: RowItem) => {
  const rowId = row[idField];

  if (displayType === 'radio') {
    selectedIds.value.clear();
    selectedIds.value.add(rowId);
  } else {
    if (selectedIds.value.has(rowId)) {
      selectedIds.value.delete(rowId);
    } else {
      selectedIds.value.add(rowId);
    }
  }

  emits(
    'select',
    tableData.value.filter(r => selectedIds.value.has(r[idField]))
  );
};

// 分页切换
const handlePageChange = (page: number) => {
  currentPage.value = page;
};

// 同步外部数据更新
watch(
  () => props.data,
  (newData) => {
    tableData.value = newData;
  },
  { deep: true }
);
</script>
