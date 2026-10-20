<template>
  <div>
    <el-radio-group v-model="radio" @change="handleChange">
      <el-radio label="1">备选项1</el-radio>
      <el-radio label="2">备选项2</el-radio>
      <el-radio label="3">备选项3</el-radio>
    </el-radio-group>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const radio = ref('1')

const handleChange = (val) => {
  console.log(`选中了 ${val}`)
}
</script>
