import {
    Plugin,
    showMessage,

    getFrontend,
    getBackend,
    IModel
} from "siyuan";
import "@/index.scss";


import { SettingUtils } from "./libs/setting-utils";
const STORAGE_NAME = "menu-config";
const TAB_TYPE = "custom_tab";
const DOCK_TYPE = "dock_tab";

export default class PluginSample extends Plugin {

    customTab: () => IModel;
    private isMobile: boolean;
    private settingUtils: SettingUtils;
    private checkInterval: number; // 用于存储定时器ID
    private tabInfo: Array<{dataId: string, count: number}> = [];  // 声明 tabInfo 数组

    async onload() {
        this.data[STORAGE_NAME] = { readonlyText: "Readonly" };

        console.log("loading plugin-sample", this.i18n);

        // 判断是否是移动端
        const frontEnd = getFrontend();
        this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

        // 设置插件的设置项
        this.settingUtils = new SettingUtils({
            plugin: this, name: STORAGE_NAME
        });
        // 添加是否开启定时关闭页签功能设置项
        this.settingUtils.addItem({
            key: "Check",
            value: true,
            type: "checkbox",
            title: "是否开启定时关闭页签功能",
            description: "开启后，超过设置时间未活跃的页签将被自动关闭",
            action: {
                callback: () => {
                    // Return data and save it in real time
                    let value = !this.settingUtils.get("Check");
                    this.settingUtils.set("Check", value);
                    console.log("Check",value);
                }
            }
        });

        // 初始化定时检查
        this.initAutoClose();
        
        // 添加自动关闭设置
        this.settingUtils.addItem({
            key: "stayOpen",
            value: 30 , // 默认30分钟
            type: "slider",
            title: "不活跃时间阈值(秒)",
            description: "超过此时间的标签页将被自动关闭",
            slider: {
                min: 5,
                max: 600,
                step: 5
            }
        });

        this.settingUtils.addItem({
            key: "exception",
            value: "",
            type: "textinput",
            title: "包含如下字符串的标签页将不执行自动关闭：",
            description: "以|隔空",
            action: {
                // Called when focus is lost and content changes
                callback: () => {
                    // Return data and save it in real time
                    let value = this.settingUtils.takeAndSave("exception");
                    console.log(value);
                }
            }
        });

        // 加载设置
        try {
            this.settingUtils.load();
        } catch (error) {
            console.error("Error loading settings storage, probably empty config json:", error);
        }

        console.log(this.i18n.helloPlugin);

    }

    // 布局加载完成时执行
    onLayoutReady() {
        this.loadData(STORAGE_NAME);
        this.settingUtils.load();
        console.log(`frontend: ${getFrontend()}; backend: ${getBackend()}`);
        console.log(
            "默认设置:\n" +
            this.settingUtils.get("stayOpen") + "\n" +
            this.settingUtils.get("exception") + "\n" +
            this.settingUtils.get("Check") + "\n"
        );
    }

    // 插件卸载时执行
    async onunload() {
        console.log(this.i18n.byePlugin);
        showMessage("Goodbye SiYuan Plugin");
        console.log("onunload，卸载");
        // 清除定时器
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
        }
    }

    // 插件卸载时执行
    uninstall() {
        console.log("插件已卸载");
    }

    // 事件总线日志
    private eventBusLog({ detail }: any) {
        console.log(detail);
    }

    private initAutoClose() {
        console.log("初始化自动关闭功能");
        // 每分钟检查一次
        this.checkInterval = window.setInterval(() => {
            console.log("执行定时检查...");

            // 检查功能是否启用
            const isEnabled = this.settingUtils.get("Check");
            if (!isEnabled) {
                console.log("自动关闭功能已禁用");
                return;
            }
            this.checkToClose();
        }, 5 * 1000);
        console.log("定时器已设置，ID:", this.checkInterval);
    }

    private async checkToClose() {
        // 1. 计算时间阈值
        const stayOpenMinutes = this.settingUtils.get("stayOpen");    // 获取设置的保持打开时间
        console.log("保持打开时间:", stayOpenMinutes);

        // 2. 初始化计数和存储
        let count = 0;  
        // 声明具有明确类型的对象字面量
        interface tabInfo {
            dataId: string;
            count: number;
        }
        
        // 3. 获取所有标签页
        const tabs = document.querySelectorAll('li[data-type="tab-header"]');
        console.log("当前打开的标签页数量:", tabs.length);
        console.log("当前打开的标签页具体信息:", tabs);

        // 4. 收集所有标签的 data-id 和初始计数 1
        tabs.forEach((tab) => {
            const dataId = tab.getAttribute('data-id');
            console.log("当前dataId:", dataId);

            if (dataId) {
                const existingTab = this.tabInfo.find(item => item.dataId === dataId);
                if (existingTab) {
                    // 如果已存在，计数加5
                    existingTab.count += 5;
                    console.log(`标签 ${dataId} 重复出现，当前计数: ${existingTab.count}`);
                } else {
                    // 如果不存在，添加新记录，初始计数为1
                    console.log("不存在，添加新记录，初始计数为1");
                    this.tabInfo.push({
                        dataId: dataId,
                        count: 1
                    });
                    console.log(`添加标签信息:`, {
                        'data-id': dataId,
                        '计数': 1
                    });
                }
            }
        });

        // 5. 输出统计信息
        console.log("所有标签信息数组:", this.tabInfo);
        
        // 读取 exception 的值并以 | 分割
        const exceptions = this.settingUtils.get("exception").split('|').map(item => item.trim());
        console.log("不关闭的标签页字符串:", exceptions);
        
        // 6. 处理标签关闭
        tabs.forEach((tab: Element) => {
            const tabElement = tab as HTMLElement;
            const dataId = tabElement.getAttribute('data-id'); // 获取当前标签页的 data-id
            
            // 检查是否需要关闭
            const tabInfoEntry = this.tabInfo.find(item => item.dataId === dataId); // 查找对应的 tabInfo 条目
            
            // 检查是否包含 item--pin 或 item--focus 类
            if (tabElement.classList.contains('item--pin') || tabElement.classList.contains('item--focus')) {
                console.log("标签页被固定或聚焦，不关闭:", tabElement);
                return; // 不关闭，直接返回
            }

            // 检查 item__text 是否包含在 exceptions 中
            const itemText = tabElement.querySelector('.item__text')?.textContent || '';
            if (exceptions.some(exception => itemText.includes(exception))) {
                console.log("标签页包含在不关闭列表中:", itemText);
                return; // 不关闭，直接返回
            }

            if (tabInfoEntry && tabInfoEntry.count >= stayOpenMinutes) { // 如果 count 大于等于 stayOpenMinutes
                // 找到并点击关闭按钮
                const closeButton = tabElement.querySelector('.item__close');
                console.log({
                    tabElement: tabElement,
                    tabInfoEntry: tabInfoEntry,
                    closeButton: closeButton
                }); // 同时输出三个变量的值
                if (closeButton) {
                    console.log("执行点击");
                    (closeButton as HTMLElement).click();
                }
            }
        });
    }



}
