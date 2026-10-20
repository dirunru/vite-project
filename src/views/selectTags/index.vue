<template>
  <el-select
    v-model="selectedValues"
    multiple
    placeholder="请选择"
  >
    <!-- 自定义 tag 渲染：在关闭前拦截，并决定是否真的移除 -->
    <template #tag>
      <el-tag v-for="color in selectedValues" :key="color.value" closable @close="(e) => handleTagClose(color, e)">
        {{ color.label }}
      </el-tag>
    </template>
    <el-option
      v-for="item in options"
      :key="item.value"
      :label="item.label"
      :value="item"
    ></el-option>
  </el-select>
</template>

<script setup>
import { ref } from 'vue';

// 选中值（多选为数组）
const selectedValues = ref([]); // 默认选中前两个

// 选项数据（可添加自定义属性控制是否允许移除）
const options = ref([
  { value: '1', label: '选项1' }, 
  { value: '2', label: '选项2' },
  { value: '3', label: '选项3' }
]);

// 通过自定义 tag 的关闭事件来决定是否删除（在删除前拦截）
const handleTagClose = (option, e) => {
  if (option.value === '1') {
    e.preventDefault(); // 阻止删除
    return;
  }
  selectedValues.value = selectedValues.value.filter(item => item.value !== option.value);
};
</script>