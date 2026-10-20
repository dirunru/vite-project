import { defineStore } from "pinia";

const useUserInfoStore = defineStore("userInfo", {
  // defineStore('userInfo',{})  userInfo就是这个仓库的名称name
  state: () => ({
    username: "赫赫",
    age: 30,
    like: "girl",
    obj: { money: 100, friend: 10 },
    hobby: [
      { id: 1, name: "篮球", level: 1 },
      { id: 2, name: "rap", level: 10 },
    ],
  }),
  persist: true,
  // persist: {
  //   key: 'piniaStore', //存储名称
  //   storage: sessionStorage, // 存储方式
  //   paths: ['username', 'like','obj']//指定 state 中哪些数据需要被持久化。[] 表示不持久化任何状态，undefined 或 null 表示持久化整个 state
  // }
});

export default useUserInfoStore;
