export class TimelineView extends UI.VBox {
    constructor() {
        super(true);
        this.setMinimumSize(200, 100);

        this._nodes = [];
        this._started = false;
        this._startTime = 0;
        this._nodeForId = {};
        this._filter = (node) => true;
        this._columns = [
            {
                id: 'name',
                title: ls`Name`,
                visible: true,
                sortable: true,
                weight: 50,
            },
            {
                id: 'method',
                title: ls`Method`,
                visible: true,
                sortable: true,
                weight: 50,
            },
            {
                id: 'params',
                title: ls`Params`,
                visible: true,
                hideable: true,
                weight: 60,
            },
            {
                id: 'result',
                title: ls`Result`,
                visible: true,
                hideable: true,
                weight: 60,
            },
            {
                id: 'timestamp',
                title: ls`Timestamp`,
                visible: false,
                sortable: true,
                hideable: true,
                weight: 30,
            },
        ];

        this.contentElement.classList.add('jsna-timeline');

        // 顶部toolbar开始
        const topToolbar = new UI.Toolbar('jsna-toolbar', this.contentElement);
        // 录制
        const recordButton = new UI.ToolbarToggle(ls`Record`, 'largeicon-start-recording', 'largeicon-stop-recording');
        recordButton.addEventListener(UI.ToolbarButton.Events.Click, () => {
            recordButton.setToggled(!recordButton.toggled());
            this._setRecording(recordButton.toggled());
        });
        recordButton.setToggleWithRedColor(true);
        topToolbar.appendToolbarItem(recordButton);
        recordButton.setToggled(true);

        // 清空
        const clearButton = new UI.ToolbarButton(ls`Clear all`, 'largeicon-clear');
        clearButton.addEventListener(UI.ToolbarButton.Events.Click, () => {
            this._dataGrid.rootNode().removeChildren();
            this._nodes = [];
            this._nodeForId = {};
        });
        topToolbar.appendToolbarItem(clearButton);
        topToolbar.appendSeparator();

        const split = new UI.SplitWidget(true, true, 'jsna-split', 250);
        split.show(this.contentElement);
        this._dataGrid = new DataGrid.SortableDataGrid({
            displayName: ls`jsNative Monitor`,
            columns: this._columns,
        });
        this._dataGrid.element.style.flex = '1';
        this._infoWidget = new InfoWidget();
        split.setMainWidget(this._dataGrid.asWidget());
        split.setSidebarWidget(this._infoWidget);
        this._dataGrid.addEventListener(DataGrid.DataGrid.Events.SelectedNode, (event) =>
            this._infoWidget.render(event.data.data)
        );
        this._dataGrid.addEventListener(DataGrid.DataGrid.Events.DeselectedNode, (event) =>
            this._infoWidget.render(null)
        );
        this._dataGrid.setHeaderContextMenuCallback(this._innerHeaderContextMenu.bind(this));
        this._dataGrid.setRowContextMenuCallback(this._innerRowContextMenu.bind(this));

        this._dataGrid.addEventListener(DataGrid.DataGrid.Events.SortingChanged, this._sortDataGrid.bind(this));
        this._dataGrid.setStickToBottom(true);
        this._dataGrid.sortNodes(DataGrid.SortableDataGrid.NumericComparator.bind(null, 'timestamp'), false);
        this._updateColumnVisibility();

        const keys = ['method', 'name'];
        this._filterParser = new TextUtils.FilterParser(keys);
        this._suggestionBuilder = new UI.FilterSuggestionBuilder(keys);

        this._textFilterUI = new UI.ToolbarInput(
            ls`Filter`,
            '',
            1,
            0.2,
            '',
            this._suggestionBuilder.completions.bind(this._suggestionBuilder)
        );
        this._textFilterUI.addEventListener(UI.ToolbarInput.Event.TextChanged, (event) => {
            const query = /** @type {string} */ (event.data);
            const filters = this._filterParser.parse(query);
            this._filter = (node) => {
                for (const {key, text, negative} of filters) {
                    if (!text) {
                        continue;
                    }
                    const data = key ? node.data[key] : node.data;
                    if (!data) {
                        continue;
                    }
                    const found = JSON.stringify(data).toLowerCase().indexOf(text.toLowerCase()) !== -1;
                    if (found === negative) {
                        return false;
                    }
                }
                return true;
            };
            this._filterNodes();
        });
        topToolbar.appendToolbarItem(this._textFilterUI);
    }
    _filterNodes() {
        for (const node of this._nodes) {
            if (this._filter(node)) {
                if (!node.parent) {
                    this._dataGrid.insertChild(node);
                }
            } else {
                node.remove();
            }
        }
    }

    _innerHeaderContextMenu(contextMenu) {
        const columnConfigs = this._columns.filter((columnConfig) => columnConfig.hideable);
        for (const columnConfig of columnConfigs) {
            contextMenu
                .headerSection()
                .appendCheckboxItem(
                    columnConfig.title,
                    this._toggleColumnVisibility.bind(this, columnConfig),
                    columnConfig.visible
                );
        }
    }

    /**
     * @param {!UI.ContextMenu} contextMenu
     * @param {!ProtocolNode} node
     */
    _innerRowContextMenu(contextMenu, node) {
        contextMenu.defaultSection().appendItem(ls`Filter`, () => {
            this._textFilterUI.setValue(`method:${node.data.method}`, true);
        });
    }

    /**
     * @param {!Object} columnConfig
     */
    _toggleColumnVisibility(columnConfig) {
        columnConfig.visible = !columnConfig.visible;
        this._updateColumnVisibility();
    }

    _updateColumnVisibility() {
        const visibleColumns = /** @type {!Object.<string, boolean>} */ ({});
        for (const columnConfig of this._columns) {
            visibleColumns[columnConfig.id] = columnConfig.visible;
        }
        this._dataGrid.setColumnsVisiblity(visibleColumns);
    }

    _sortDataGrid() {
        const sortColumnId = this._dataGrid.sortColumnId();
        if (!sortColumnId) {
            return;
        }

        let columnIsNumeric = true;
        switch (sortColumnId) {
            case 'method':
            case 'name':
                columnIsNumeric = false;
                break;
        }

        const comparator = columnIsNumeric
            ? DataGrid.SortableDataGrid.NumericComparator
            : DataGrid.SortableDataGrid.StringComparator;
        this._dataGrid.sortNodes(comparator.bind(null, sortColumnId), !this._dataGrid.isSortOrderAscending());
    }

    /**
     * @override
     */
    wasShown() {
        if (this._started) {
            return;
        }
        this._started = true;
        this._startTime = Date.now();
        this._setRecording(true);
    }

    /**
     * @param {boolean} recording
     */
    _setRecording(recording) {
        if (recording) {
            runtime.bridge.registerEvent('JSNative.invoke', this._onInvoke.bind(this));
            runtime.bridge.registerEvent('JSNative.invokeResult', this._onInvokeResult.bind(this));
        } else {
            runtime.bridge.registerEvent('JSNative.invokeResult', this._onInvokeResult.bind(this));
            runtime.bridge.registerEvent('JSNative.invoke', null);
        }
    }
    _onInvokeResult(message) {
        // TODO 更新结果，根据id
    }
    _onInvoke(message) {
        const node = new DescriptionNode({
            name: message.name,
            method: message.method,
            params: message.params,
        });
        this._nodes.push(node);
        if (this._filter(node)) {
            this._dataGrid.insertChild(node);
        }
    }
}

export class DescriptionNode extends DataGrid.SortableDataGridNode {
    constructor(data) {
        super(data);
        this.hasError = false;
    }

    /**
     * @override
     * @param {string} columnId
     * @return {!Element}
     */
    createCell(columnId) {
        switch (columnId) {
            case 'name':
            case 'method':
                const cell = this.createTD(columnId);
                cell.textContent = this.data[columnId];
                return cell;
            case 'result':
            case 'params': {
                const cell = this.createTD(columnId);
                const obj = SDK.RemoteObject.fromLocalObject(this.data[columnId]);
                cell.textContent = obj.description.trimEndWithMaxLength(50);
                cell.classList.add('source-code');
                return cell;
            }
        }
        return super.createCell(columnId);
    }

    /**
     * @override
     */
    element() {
        const element = super.element();
        element.classList.toggle('protocol-message-sent', this.data.direction === 'sent');
        element.classList.toggle('protocol-message-recieved', this.data.direction !== 'sent');
        element.classList.toggle('error', this.hasError);
        return element;
    }
}

export class InfoWidget extends UI.VBox {
    constructor() {
        super();
        this._tabbedPane = new UI.TabbedPane();
        this._tabbedPane.appendTab('params', 'Params', new UI.Widget());
        this._tabbedPane.appendTab('result', 'Result', new UI.Widget());
        this._tabbedPane.show(this.contentElement);
        this._tabbedPane.selectTab('params');
        this.render(null);
    }

    render(data) {
        this._tabbedPane.setTabEnabled('result', true);
        if (!data) {
            this._tabbedPane.changeTabView('result', new UI.EmptyWidget(ls`No message selected`));
            this._tabbedPane.changeTabView('params', new UI.EmptyWidget(ls`No message selected`));
            return;
        }
        this._tabbedPane.selectTab('params');

        this._tabbedPane.changeTabView('result', SourceFrame.JSONView.createViewSync(data.result));
        this._tabbedPane.changeTabView('params', SourceFrame.JSONView.createViewSync(data.params));
    }
}
