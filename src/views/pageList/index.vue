<template>
  <div>
    <h3>显示为Radio的选中状态</h3>
    <SelectableTable
      :data="tableData"
      :columns="columns"
      display-type="radio"
      id-field="value"
      @select="onSelect"
    >
      <template #label="{ row }">
        <span style="font-weight: bold">{{ row.label }}</span>
      </template>

      <template #value="{ value }">
        <span style="color: #ff6600">￥{{ value }}</span>
      </template>
    </SelectableTable>

    <h3>显示为Checkbox的选中状态</h3>
    <SelectableTable
      :data="tableData"
      :columns="columns"
      display-type="checkbox"
      id-field="value"
      @select="onSelect"
    />

    <el-button @click="showSelected">查看选中</el-button>
  </div>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import SelectableTable from "../radioTable/index.vue";
// 生成100条模拟数据
const generateMockData = () => {
  const fruits = ['苹果', '香蕉', '橙子', '葡萄', '草莓', '西瓜', '梨', '桃子', '菠萝', '芒果'];
  const units = ['个', 'kg', '斤', '箱'];
  
  return Array.from({ length: 100 }, (_, i) => ({
    label: `${fruits[i % fruits.length]}${i + 1}`,
    value: `A${String(i + 1).padStart(3, '0')}`,
    unit: units[i % units.length],
    category: "水果"
  }));
};

const tableData = ref(generateMockData());

const columns = [
  { prop: "label", label: "中文名" },
  { prop: "value", label: "代码" },
  { prop: "unit", label: "单位" },
  { prop: "category", label: "分类" },
];

const selectedRows = ref([]);

const onSelect = (rows: any[]) => {
  selectedRows.value = rows;
};

const showSelected = () => {
  console.log("选中行:", selectedRows.value);
  alert(JSON.stringify(selectedRows.value));
};
</script>
