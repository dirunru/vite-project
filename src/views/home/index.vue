<template>
  <el-container>
    <el-header>Header</el-header>
    <el-container>
      <el-aside width="200px">Aside</el-aside>
      <el-main>
        <div>
          <h3>单选示例</h3>
          <SelectableTable
            ref="radioTable"
            type="radio"
            :data="tableData"
            :columns="columns"
            @select="onSelectRadio"
          />

          <h3>多选示例</h3>
          <SelectableTable
            ref="checkboxTable"
            type="checkbox"
            :data="tableData"
            :columns="columns"
            @select="onSelectCheckbox"
          />

          <el-button @click="getRadio">获取单选选中</el-button>
          <el-button @click="getCheckbox">获取多选选中</el-button>
        </div>
      </el-main>
    </el-container>
    <el-footer>Footer</el-footer>
  </el-container>
</template>

<script setup lang="ts">
import SelectableTable  from "@/views/selectTable/index.vue";
import { ref } from "vue";

const radioTable = ref<any>(null);
const checkboxTable = ref<any>(null);

const tableData = ref([
  { label: '苹果', value: 'A001', unit: '个', category: '水果' },
  { label: '橙子', value: 'A002', unit: '个', category: '水果' },
  { label: '香蕉', value: 'A003', unit: '个', category: '水果' },
]);

const columns = [
  { prop: 'label', label: '中文名' },
  { prop: 'value', label: '代码'},
  { prop: 'unit', label: '单位' },
  { prop: 'category', label: '分类' },
];

const onSelectRadio = (row: any) => console.log('单选选中:', row);
const onSelectCheckbox = (rows: any[]) => console.log('多选选中:', rows);

const getRadio = () => {
  console.log('单选当前选中:', radioTable.value.getSelected());
};

const getCheckbox = () => {
  console.log('多选当前选中:', checkboxTable.value.getSelected());
};
</script>

<style lang="scss" scoped>
.el-header,
.el-footer {
  background-color: #b3c0d1;
  color: #333;
  text-align: center;
  line-height: 60px;
}

.el-aside {
  background-color: #d3dce6;
  color: #333;
  text-align: center;
  line-height: 200px;
}

.el-main {
  background-color: #e9eef3;
  color: #333;
  text-align: center;
  line-height: 160px;
}

body > .el-container {
  margin-bottom: 40px;
}
</style>
