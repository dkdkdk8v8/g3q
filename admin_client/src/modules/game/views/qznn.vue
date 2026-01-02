<template>
</template>

<script lang="ts" name="game-room-qznn" setup>
import { useCool } from "/@/cool";

const { service } = useCool();

service.game.room.qznn()
.then((res) => {
  console.log(res);
})
.catch((err) => {
  console.error(err);
});
</script>
