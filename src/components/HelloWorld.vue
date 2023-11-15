<script setup>
import { ref, reactive, computed } from "vue";

const count = ref(0);
const history = reactive([]);
const data = computed(() => {

});

</script>

<template>
  <div>
    {{ count }}
  </div>
  <div>
    {{ history }}
  </div>
  <div>
    {{ data }}
  </div>
</template>
