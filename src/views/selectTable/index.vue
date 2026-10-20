<template>
  <div>
    <el-table
      ref="tableRef"
      :data="tableData"
      :header-cell-style="headerStyle"
      border
      stripe
      style="width: 100%"
      v-loading="loading"
      @row-click="handleRowClick"
    >
      <!-- 选择列 -->
      <el-table-column label="选择" width="60">
        <template #default="scope">
          <template v-if="type === 'radio'">
            <el-radio
              v-model="selectedValue"
              :label="scope.row[valueField]"
              @change="() => handleSelect(scope.row)"
            />
          </template>
          <template v-else-if="type === 'checkbox'">
            <el-checkbox
              v-model="selectedValues"
              :label="scope.row[valueField]"
              @change="() => handleSelect(scope.row)"
            />
          </template>
        </template>
      </el-table-column>

      <!-- 自定义列 -->
      <el-table-column
        v-for="col in columns"
        :key="col.prop || col.label"
        v-bind="col"
      />
    </el-table>
  </div>
</template>

<script lang="ts" setup>
import { ref, defineProps, defineEmits, watch } from 'vue';
import type { Table } from 'element-plus';
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
  type?: 'radio' | 'checkbox';
  loading?: boolean;
  valueField?: string;
  defaultValue?: string | number;
  defaultValues?: Array<string | number>;
  headerStyle?: object;
}>();

const emits = defineEmits<{
  (e: 'select', row: RowItem | RowItem[]): void;
  (e: 'row-click', row: RowItem): void;
}>();

const tableRef = ref<Table | null>(null);
const tableData = ref<RowItem[]>(props.data);
const loading = ref<boolean>(props.loading ?? false);
const headerStyle = ref<object>(props.headerStyle ?? { background: '#eef1f6', color: '#909399' });
const valueField = props.valueField ?? 'value';
const type = props.type ?? 'radio';

const selectedValue = ref<string | number>(props.defaultValue ?? '');
const selectedValues = ref<Array<string | number>>(props.defaultValues ?? []);

// 监听 data 更新
watch(() => props.data, (val) => tableData.value = val ?? []);
watch(() => props.loading, (val) => loading.value = val ?? false);

// 行点击事件
const handleRowClick = (row: RowItem) => {
  if (type === 'radio') {
    selectedValue.value = row[valueField];
    emits('select', row);
  } else if (type === 'checkbox') {
    const index = selectedValues.value.indexOf(row[valueField]);
    if (index === -1) selectedValues.value.push(row[valueField]);
    else selectedValues.value.splice(index, 1);
    emits('select', getSelected());
  }
  emits('row-click', row);
};

// 方法：获取选中项
const getSelected = () => {
  if (type === 'radio') {
    return tableData.value.find(item => item[valueField] === selectedValue.value) as RowItem;
  } else {
    return tableData.value.filter(item => selectedValues.value.includes(item[valueField]));
  }
};

// 选中事件（点击 radio/checkbox）
const handleSelect = (row: RowItem) => {
  if (type === 'radio') {
    selectedValue.value = row[valueField];
    emits('select', row);
  } else if (type === 'checkbox') {
    // 直接传递当前行，然后通过getSelected获取所有选中项
    emits('select', getSelected());
  }
};

// 方法：设置选中项
const setSelected = (value: string | number | Array<string | number>) => {
  if (type === 'radio') selectedValue.value = value as string | number;
  else if (type === 'checkbox') selectedValues.value = value as Array<string | number>;
};

defineExpose({ tableRef, getSelected, setSelected });
</script>
