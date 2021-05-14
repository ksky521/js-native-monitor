export class OverviewView extends UI.VBox {
    constructor(panel) {
        super(true);
        this.registerRequiredCSS('jsna_monitor/overview.css');

        this.setMinimumSize(200, 100);
        this.element.classList.add('jsna-overview');

        const usage = (this.$usage = createElementWithClass('div', 'js-native-overview-usage'));
        usage.innerHTML = `
        <p class="welcome">Welcome to use jsNative</p>
        <p>jsNative 是一个 JavaScript 与 Native 通信管理的库。其基于 通信接口描述，生成可调用 API。</p>
        <ul>
          <li>
            <p><a href="https://github.com/ecomfe/js-native/blob/master/doc/design.md" target="_blank">了解为什么设计成这样</a></p>
          </li>
          <li>
            <p><a href="https://github.com/ecomfe/js-native/blob/master/doc/spec.md" target="_blank">实现的一些约束</a></p>
          </li>
          <li>
            <p><a href="https://github.com/ecomfe/js-native/blob/master/doc/description.md" target="_blank">通信接口描述</a></p>
          </li>
        </ul>
        <div id="app-env">

        </div>
      `;
        this.contentElement.appendChild(usage);
    }
    wasShown() {
        this._apisSet = this._apisSet || new Set();
        // 事件绑定
        runtime.bridge.sendCommand('jsNative.getEnv').then((env) => {
            setTimeout(() => {
                document.getElementById('app-env').innerHTML(JSON.stringify(env));
            }, 3000);
        });
    }
}
