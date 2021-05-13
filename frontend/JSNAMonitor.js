import {OverviewView} from './OverviewView.js';
import {TimelineView} from './TimelineView.js';
import {DescriptionView} from './DescriptionView.js';

export class JSNAMonitorPanel extends UI.PanelWithSidebar {
    constructor() {
        super('js-native');
        // this.registerRequiredCSS('jsna_monitor/jsna.css');
        this.element.classList.add('jsna-panel');

        this._overviewView = new OverviewView(this);
        this._sidebarOverviewViewElement = this._createSidebarTreeElement('Overview', this._overviewView);

        this._timelineView = new TimelineView(this);
        this._sidebarTimelineViewElement = this._createSidebarTreeElement('Timeline', this._timelineView);

        this._descriptionView = new DescriptionView(this);
        this._sidebarDescriptionViewElement = this._createSidebarTreeElement('Description', this._descriptionView);

        this._sidebarTree = new UI.TreeOutlineInShadow();
        this._sidebarTree.registerRequiredCSS('jsna_monitor/sidebar.css');
        this._sidebarTree.appendChild(this._sidebarOverviewViewElement);
        this._sidebarTree.appendChild(this._sidebarTimelineViewElement);
        this._sidebarTree.appendChild(this._sidebarDescriptionViewElement);

        this.panelSidebarElement().appendChild(this._sidebarTree.element);
    }

    focus() {
        this._sidebarTree.focus();
    }

    wasShown() {
        super.wasShown();
        if (!this._visibleView) {
            this._sidebarOverviewViewElement.select(true);
        }
    }

    /**
     * @param {!UI.VBox} view
     */
    _setVisibleView(view) {
        if (this._visibleView === view) return;

        if (this._visibleView) {
            this._visibleView.detach();
        }

        this._visibleView = view;

        if (view) {
            this.splitWidget().setMainWidget(view);
        }
    }

    _createSidebarTreeElement(title, view) {
        const titleElement = createElementWithClass('span', 'title');
        titleElement.textContent = Common.UIString(title);
        return new SidebarTreeElement(titleElement, this._setVisibleView.bind(this, view), 'jsna-sidebar-tree-item');
    }
}

class SidebarTreeElement extends UI.TreeElement {
    /**
     * @param {!Element} textElement
     * @param {function()} selectCallback
     * @param {string} className
     */
    constructor(textElement, selectCallback, className) {
        super('', false);

        this._selectCallback = selectCallback;
        this.listItemElement.classList.add(className);
        this.listItemElement.appendChild(textElement);
    }

    /**
     * @override
     * @return {boolean}
     */
    onselect() {
        this._selectCallback();
        return true;
    }
}
