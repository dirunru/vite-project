<template>
  <el-table
    :data="tableData"
    ref="multipleTableRef"
    border
    row-key="id"
    :row-class-name="getRowClassName"
    :header-row-class-name="getHeaderRowClassName"
    size="mini"
    max-height="500px"
    style="width: 100%"
    @select="selectFun"
    @select-all="selectAllFun"
    @selection-change="selectionChangeFun"
    :header-cell-style="{ background: '#fafafa' }"
  >
    <el-table-column type="selection" width="55"> </el-table-column>
    <el-table-column prop="date" label="日期" sortable width="180"> </el-table-column>
    <el-table-column prop="name" label="姓名" sortable width="180"> </el-table-column>
    <el-table-column prop="address" label="地址"> </el-table-column>
  </el-table>
</template>

<script setup lang="ts">

import { ref, onMounted, nextTick } from "vue";

// 表格引用
const multipleTableRef = ref<any>(null);

// 表格数据
const tableData = ref([
  {
    id: 1,
    date: "2016-05-02",
    name: "王小虎",
    address: "上海市普陀区金沙江路 1518 弄",
  },
  {
    id: 2,
    date: "2016-05-01",
    name: "王小虎",
    address: "上海市普陀区金沙江路 1519 弄",
    children: [
      {
        id: 3,
        date: "2016-05-01",
        name: "王小虎",
        address: "上海市普陀区金沙江路 1519 弄",
        children: [
          {
            id: 4,
            date: "2016-05-01",
            name: "王小虎",
            address: "上海市普陀区金沙江路 1519 弄",
          },
          {
            id: 5,
            date: "2016-05-01",
            name: "王小虎",
            address: "上海市普陀区金沙江路 1519 弄",
          },
        ],
      },
      {
        id: 6,
        date: "2016-05-01",
        name: "王小虎",
        address: "上海市普陀区金沙江路 1519 弄",
      },
    ],
  },
]);

// 勾选中的行数据
const selectedData = ref<any[]>([]);

// 使用Map提高查找效率
const nodeMap = ref<Map<any, any>>(new Map());

// 初始化数据
const initData = (data: any[], parentId?: any) => {
  data &&
    data.length &&
    data.forEach((item) => {
      item.isSelect = false;
      parentId && (item.parentId = parentId);
      nodeMap.value.set(item.id, item);
      
      if (item.children && item.children.length) {
        initData(item.children, item.id);
      }
    });
};

// 监听选中事件
const selectionChangeFun = (selection: any[]) => {
  selectedData.value = selection;
};

// 复选框点击事件
const selectFun = (selection: any[], row: any) => {
  setRowIsSelect(row);
};

// 设置行选中状态
const setRowIsSelect = (row: any) => {
  // 处理半选状态点击
  if (row.isSelect === "") {
    multipleTableRef.value?.toggleRowSelection(row, true);
  }
  
  // 切换选中状态
  row.isSelect = !row.isSelect;

  // 根据节点类型执行不同操作
  const levelStatus = getNodeLevel(row);
  
  switch(levelStatus) {
    case 1: // 仅父级节点
      updateChildrenSelection(row);
      break;
    case 2: // 既是父级又是子级
      updateChildrenSelection(row);
      updateParentSelection(row);
      break;
    case 3: // 仅子级节点
      updateParentSelection(row);
      break;
  }
};

// 获取节点层级类型
const getNodeLevel = (row: any) => {
  if (row.parentId === undefined) {
    return 1; // 仅父级
  } else if (row.parentId && !(row.children && row.children.length)) {
    return 3; // 仅子级
  } else {
    return 2; // 既是父级又是子级
  }
};

// 更新子节点选择状态
const updateChildrenSelection = (row: any) => {
  const updateChildren = (children: any[]) => {
    children?.forEach((child) => {
      child.isSelect = row.isSelect;
      toggleRowSelection(child, row.isSelect);
      
      if (child.children && child.children.length) {
        updateChildren(child.children);
      }
    });
  };
  
  if (row.children && row.children.length) {
    updateChildren(row.children);
  }
};

// 更新父节点选择状态
const updateParentSelection = (row: any) => {
  const updateParent = (parentId: any) => {
    const parent = nodeMap.value.get(parentId);
    if (!parent) return;
    
    const childrenStatus = getChildrenSelectionStatus(parent.children);
    
    // 根据子节点状态更新父节点状态
    if (childrenStatus.allSelected) {
      parent.isSelect = true;
      toggleRowSelection(parent, true);
    } else if (childrenStatus.allUnselected) {
      parent.isSelect = false;
      toggleRowSelection(parent, false);
    } else {
      parent.isSelect = "";
    }
    
    // 如果还有父节点，继续向上更新
    if (parent.parentId !== undefined) {
      updateParent(parent.parentId);
    }
  };
  
  if (row.parentId !== undefined) {
    updateParent(row.parentId);
  }
};

// 获取子节点选择状态
const getChildrenSelectionStatus = (children: any[]) => {
  const getStatus = (childs: any[], statusArr: any[] = []) => {
    childs?.forEach((child) => {
      statusArr.push(child.isSelect);
      if (child.children && child.children.length) {
        getStatus(child.children, statusArr);
      }
    });
    return statusArr;
  };
  
  const statusArray = getStatus(children);
  return {
    allSelected: statusArray.every(status => status === true),
    allUnselected: statusArray.every(status => status === false)
  };
};

// 表格全选事件
const selectAllFun = (selection: any[]) => {
  const isAllSelect = tableData.value.every(item => item.isSelect);
  
  tableData.value.forEach((item) => {
    item.isSelect = isAllSelect;
    toggleRowSelection(item, !isAllSelect);
    selectFun(selection, item);
  });
};

// 设置当前行的选中态
const toggleRowSelection = (row: any, flag: boolean) => {
  if (row) {
    nextTick(() => {
      multipleTableRef.value?.toggleRowSelection(row, flag);
    });
  }
};

// 表格行样式
const getRowClassName = ({ row }: { row: any }) => {
  return row.isSelect === "" ? "indeterminate" : "";
};

// 表格标题样式
const getHeaderRowClassName = ({ row }: { row: any }) => {
  const isIndeterminate = tableData.value.some(item => item.isSelect === "");
  return isIndeterminate ? "indeterminate" : "";
};

// 生命周期钩子
onMounted(() => {
  initData(tableData.value);
});
</script>

<style lang="scss">
.indeterminate {
  .el-checkbox__input .el-checkbox__inner {
    background-color: #409eff !important;
    border-color: #409eff !important;
    color: #fff !important;
  }
  .el-checkbox__input.is-checked .el-checkbox__inner::after {
    transform: scale(0.5);
  }
  .el-checkbox__input .el-checkbox__inner {
    background-color: #f2f6fc;
    border-color: #dcdfe6;
  }
  .el-checkbox__input .el-checkbox__inner::after {
    border-color: #c0c4cc !important;
    background-color: #c0c4cc;
    content: "";
    position: absolute;
    display: block;
    background-color: #fff;
    height: 2px;
    transform: scale(0.5);
    left: 0;
    right: 0;
    top: 5px;
    width: auto !important;
  }
}
</style>
