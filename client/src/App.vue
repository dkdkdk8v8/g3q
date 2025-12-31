<script setup lang="ts">
</script>

<template>
  <div class="container">
    <h1>Welcome to Vue 3 + Vant</h1>
    <van-button type="primary">Hello Vant</van-button>
    <van-cell-group inset style="margin-top: 20px;">
      <van-cell title="单元格" value="内容" />
      <van-cell title="单元格" value="内容" label="描述信息" />
    </van-cell-group>
  </div>
</template>

<style scoped>
.container {
  padding: 20px;
  text-align: center;
}
</style>
