import React from 'react';
import classNames from 'classnames';
import { LocalizerType } from '../types/Util';
import { ConversationListItem } from './ConversationListItem';
import { AutoSizer, List } from 'react-virtualized';
import Dialog from './Dialog';

export interface Props {
  conversations: Array<any>;
  selectedConversation: Array<any>;
  folderName: string;
  i18n: LocalizerType;
  onCancel: () => void;
  isBarOperation?: boolean;
}

export interface State {
  conversations: any;
  currentConversations: any;
  selectedConversations: any;
}

export class FolderSelectConversationDialog extends React.Component<
  Props,
  State
> {
  private readonly inputRef: React.RefObject<HTMLInputElement>;
  private searchText: string;

  constructor(props: Readonly<Props>) {
    super(props);
    this.inputRef = React.createRef();

    const selectedConversationIds = props.selectedConversation.map(c => {
      return c.id;
    });
    const conversations: any = [];
    const currentConversations: any = [];
    const length = props.conversations.length;
    for (let i = 0; i < length; i += 1) {
      if (!selectedConversationIds.includes(props.conversations[i].id)) {
        conversations.push(props.conversations[i]);
        if (props.conversations[i].activeAt) {
          currentConversations.push(props.conversations[i]);
        }
      }
    }
    currentConversations.sort(this.itemSort);
    conversations.sort(this.itemSort);
    this.state = {
      conversations,
      currentConversations,
      selectedConversations: [...props.selectedConversation],
    };
    this.searchText = '';
  }

  public itemSort = (left: any, right: any) => {
    const { i18n } = this.props;
    const collator = new Intl.Collator();

    // 置顶排序
    if (left.isStick && !right.isStick) {
      return -1;
    }
    if (!left.isStick && right.isStick) {
      return 1;
    }
    if (left.isStick && right.isStick && right.activeAt !== left.activeAt) {
      return right.activeAt - left.activeAt;
    }

    // 活跃排序
    if (left.activeAt && !right.activeAt) {
      return -1;
    }
    if (!left.activeAt && right.activeAt) {
      return 1;
    }

    const leftTimestamp = left.timestamp;
    const rightTimestamp = right.timestamp;
    if (leftTimestamp && !rightTimestamp) {
      return -1;
    }
    if (rightTimestamp && !leftTimestamp) {
      return 1;
    }
    if (leftTimestamp && rightTimestamp && leftTimestamp !== rightTimestamp) {
      return rightTimestamp - leftTimestamp;
    }

    const getName = (item: any) => {
      if (item.name) {
        return item.name.toLowerCase();
      }
      if (item.type === 'group') {
        return i18n('unknownGroup').toLowerCase();
      }
      return item.id;
    };

    const leftTitle = getName(left);
    const rightTitle = getName(right);
    return collator.compare(leftTitle, rightTitle);
  };

  public onCheck = () => {
    if (this.props.isBarOperation) {
      const cids = this.state.selectedConversations.map((c: any) => {
        const idv2 = (window as any).Signal.ID.convertIdToV2(c.id);
        return {
          id: idv2,
          type: c.type === 'group' ? 1 : 0,
        };
      });

      const localChatFolder = (window as any).textsecure.storage.get(
        'chatFolder'
      );
      const localValue = localChatFolder?.value || [];
      let localVersion = localChatFolder.version;
      for (let i = 0; i < localValue.length; i++) {
        if (localValue[i].name === this.props.folderName) {
          localValue[i].cIds.length = 0;
          localValue[i].cIds = cids;
          localVersion += 1;
          break;
        }
      }

      const newChatFolder = {
        value: localValue,
        version: localVersion,
      };
      const ev = new CustomEvent('folder-bar-add-chats', {
        detail: { ...newChatFolder },
      });
      window.dispatchEvent(ev);
    } else {
      const ev = new CustomEvent('check-selected', {
        detail: this.state.selectedConversations,
      });
      window.dispatchEvent(ev);
    }

    this.props.onCancel();
  };

  public setInputFocus = () => {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  };

  public inputTextChanged = (event: React.FormEvent<HTMLInputElement>) => {
    const searchTerm = event.currentTarget.value;
    this.updateSearch(searchTerm);
    this.searchText = searchTerm;
  };

  public isSearchMatch = (c: any, searchTerm: string) => {
    if (!searchTerm) {
      return c.activeAt;
    }
    const { i18n } = this.props;
    const search = searchTerm.toLowerCase();
    let name = c.id;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.name;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.profileName;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.title;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.email;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    name = c.signature;
    if (name && name.toLowerCase().includes(search)) {
      return true;
    }

    // for self
    if (c.isMe) {
      name = i18n('noteToSelf');
      if (name.toLowerCase().includes(search)) {
        return true;
      }
    }

    return false;
  };

  public updateSearch = (searchTerm: any) => {
    let conversations: any = [];

    // 剔除右侧已存在项目
    const inRight = (item: any) => {
      const length = this.state.selectedConversations.length;
      for (let i = 0; i < length; i += 1) {
        if (this.state.selectedConversations[i].id === item.id) {
          return true;
        }
      }
      return false;
    };
    if (!searchTerm) {
      const length = this.state.conversations.length;
      for (let i = 0; i < length; i += 1) {
        if (
          this.state.conversations[i].activeAt &&
          !inRight(this.state.conversations[i])
        ) {
          conversations.push(this.state.conversations[i]);
        }
      }
    } else {
      conversations = this.state.conversations.filter((c: any) => {
        if (inRight(c)) {
          return false;
        }
        return this.isSearchMatch(c, searchTerm);
      });
    }

    this.setState({ currentConversations: conversations });
  };

  public clearSearch = () => {
    if (this.inputRef.current) {
      this.inputRef.current.value = '';
      this.updateSearch('');
      this.searchText = '';
    }
    this.setInputFocus();
  };

  public leftItemClick = (id: string) => {
    const {
      currentConversations: from,
      selectedConversations: to,
      conversations: all,
    } = this.state;

    let item;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < from.length; i += 1) {
      if (from[i].id === id) {
        item = from[i];
        from.splice(i, 1);
        break;
      }
    }

    // 也需要从 conversations 中剔除
    for (let i = 0; i < all.length; i += 1) {
      if (all[i].id === id) {
        all.splice(i, 1);
        break;
      }
    }

    if (item) {
      to.push(item);
      to.sort(this.itemSort);
      this.setState({
        currentConversations: from,
        selectedConversations: to,
        conversations: all,
      });
    }
  };

  public rightItemClick = (id: string) => {
    const {
      currentConversations: to,
      selectedConversations: from,
      conversations: all,
    } = this.state;

    let item;
    // tslint:disable-next-line:prefer-for-of
    for (let i = 0; i < from.length; i += 1) {
      if (from[i].id === id) {
        item = from[i];
        from.splice(i, 1);

        // 这边需要重新放到总的 conversations。
        all.push(item);
        all.sort(this.itemSort);
        break;
      }
    }

    // 匹配才可以加入左侧
    if (item && this.isSearchMatch(item, this.searchText)) {
      to.push(item);
      to.sort(this.itemSort);
    }
    this.setState({
      currentConversations: to,
      selectedConversations: from,
      conversations: all,
    });
  };
  public renderLeftRow = ({ index, style }: any): JSX.Element => {
    const { i18n } = this.props;
    const { currentConversations } = this.state;

    const conversation = currentConversations[index];
    return (
      <ConversationListItem
        key={conversation.id}
        style={style}
        {...conversation}
        ourNumber={'0'}
        i18n={i18n}
        onClick={this.leftItemClick}
      />
    );
  };
  public renderRightRow = ({ index, style }: any): JSX.Element => {
    const { i18n } = this.props;
    const { selectedConversations } = this.state;

    const conversation = selectedConversations[index];
    return (
      <ConversationListItem
        key={conversation.id}
        style={style}
        {...conversation}
        ourNumber={'0'}
        i18n={i18n}
        onClick={this.rightItemClick}
      />
    );
  };
  public renderLeftList(): JSX.Element | Array<JSX.Element | null> {
    const { currentConversations } = this.state;

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    const list = (
      <div
        className={classNames('module-left-pane__list', 'scroll-background')}
        key={0}
        style={{ height: '392px' }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className={'module-left-pane__virtual-list'}
              conversations={currentConversations}
              height={height}
              rowCount={currentConversations.length}
              rowHeight={56}
              rowRenderer={this.renderLeftRow}
              width={width}
              style={{ overflow: 'overlay' }}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [list];
  }

  public renderRightList(): JSX.Element | Array<JSX.Element | null> {
    const { selectedConversations } = this.state;

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    const list = (
      <div
        className={classNames('module-left-pane__list', 'scroll-background')}
        key={1}
        style={{ height: '440px' }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className={'module-left-pane__virtual-list'}
              conversations={selectedConversations}
              height={height}
              rowCount={selectedConversations.length}
              rowHeight={56}
              rowRenderer={this.renderRightRow}
              width={width}
              style={{ overflow: 'overlay' }}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [list];
  }

  public renderMiddle() {
    const { i18n } = this.props;
    const { currentConversations } = this.state;

    return (
      <div
        className={classNames('border-lightgray')}
        style={{ width: '603px', height: '442px', borderRadius: '4px' }}
      >
        <div
          className={classNames('borderRight-lightgray')}
          style={{
            width: '300px',
            height: '440px',
            float: 'left',
          }}
        >
          <div
            className="module-main-header__search"
            style={{ margin: '10px' }}
          >
            <div
              role="button"
              className="module-main-header__search__icon"
              onClick={this.setInputFocus}
            />
            <input
              type="text"
              ref={this.inputRef}
              className="module-main-header__search__input"
              style={{ width: '280px' }}
              placeholder={i18n('search')}
              dir="auto"
              onChange={this.inputTextChanged}
            />
            {this.searchText ? (
              <div
                role="button"
                className="module-main-header__search__cancel-icon"
                onClick={this.clearSearch}
              />
            ) : null}
          </div>
          {currentConversations && currentConversations.length ? (
            this.renderLeftList()
          ) : (
            <div style={{ textAlign: 'center', marginTop: '5px' }}>
              {i18n('noSearchResults', [this.searchText])}
            </div>
          )}
        </div>
        <div
          style={{ width: '300px', height: '440px', display: 'inline-block' }}
        >
          {this.renderRightList()}
        </div>
      </div>
    );
  }

  public render() {
    const { i18n, folderName, onCancel } = this.props;
    const { selectedConversations } = this.state;

    return (
      <Dialog onClose={onCancel} escClose={true}>
        <div className="forward-dialog">
          <p style={{ margin: '15px 0', fontSize: '16px', fontWeight: 500 }}>
            {!folderName || folderName.length === 0
              ? i18n('add_chats')
              : i18n('add_chats_to') + folderName}
          </p>
          {this.renderMiddle()}
          <div style={{ textAlign: 'right' }}>
            <button className={'cancel-btn'} onClick={onCancel}>
              {i18n('cancel')}
            </button>
            <button
              disabled={!selectedConversations.length}
              style={{
                cursor: selectedConversations.length
                  ? 'pointer'
                  : 'not-allowed',
                color: 'white',
                border: 'none',
                backgroundColor: selectedConversations.length
                  ? 'rgb(32, 144, 234)'
                  : 'rgb(97 167 224)',
              }}
              onClick={this.onCheck}
            >
              {i18n('folder-conversation-add', [selectedConversations.length])}
            </button>
          </div>
        </div>
      </Dialog>
    );
  }
}
