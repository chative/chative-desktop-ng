import React, { useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../../types/Util';
import { ContactListItem } from '../ContactListItem';
import Dialog from '../Dialog';
import { PropsData as ConversationListItemPropsType } from '../ConversationListItem';
import { Avatar } from '../Avatar';

export interface PropsType {
  i18n: LocalizerType;
  onClose: () => void;
  onConfirm: (members: Array<string>, options: any) => void;
  type: string;

  items: Array<any>;
  disabledItems?: Array<any>;
  groupName?: string;
  memberRapidRole: any;
  buList: Array<any>;
  leaderList: Array<any>;
  loading?: boolean;
}

import { Spin } from 'antd';

export default function CreateGroup(props: PropsType) {
  useEffect(() => {
    const whiteContainer = (window as any).document.getElementById(
      'white-container'
    ) as HTMLDivElement;
    if (whiteContainer) {
      whiteContainer.classList.add('force-no-drag');
    }

    return () => {
      const whiteContainer = (window as any).document.getElementById(
        'white-container'
      ) as HTMLDivElement;
      if (whiteContainer) {
        whiteContainer.classList.remove('force-no-drag');
      }
    };
  }, []);

  const { i18n, onClose, disabledItems } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [searchText, setSearchText] = useState('');
  const [currentItems, setCurrentItems] = useState(props.items);
  const [rightItems, setRightItems] = useState<Array<any>>([]);
  const maxGroupNameLength = 64;

  const [showConditionList, setShowConditionList] = useState(false);
  const [showBUList, setShowBUList] = useState(false);
  const [showLeaderList, setShowLeaderList] = useState(false);
  const conditionSwitchRef = useRef<HTMLDivElement>(null);

  const preCondition = useRef<string>('contact');
  const preShowCondition = useRef<boolean>(false);

  const underLeader = useRef<any>({});
  const underBu = useRef<any>({});

  const [isSelectAll, setIsSelectAll] = useState(false);

  const [loading, setLoading] = useState(false);

  let defaultName = '';
  if (props.type === 'new-group') {
    defaultName = i18n('new_group');
  }

  if (props.type === 'rapid-group') {
    defaultName = 'Rapid group';
    if (props.disabledItems && props.disabledItems.length === 2) {
      for (let i = 0; i < props.items.length; i++) {
        if (props.items[i].id === props.disabledItems[0]) {
          defaultName = props.items[i].name + ', ';
        }
        if (props.items[i].id === props.disabledItems[1]) {
          defaultName += props.items[i].name;
          break;
        }
      }
    }
  }
  if (props.type === 'group-rapid-group') {
    const existsGroupName = props.groupName || '';
    defaultName = i18n('group_editor_title_template_for_rapid_group', [
      existsGroupName,
    ]);

    const nameLen = defaultName.length;
    if (nameLen > 64) {
      const keptLen = 2 * existsGroupName.length - nameLen;
      defaultName = i18n('group_editor_title_template_for_rapid_group', [
        existsGroupName.substring(0, keptLen - 3) + '...',
      ]);
    }
  }

  const [groupName, setGroupName] = useState(defaultName);

  const renderByLeader = async (filterLeader: Array<any>) => {
    try {
      const { items } = props;
      let allIds = [] as any;
      for (let i = 0; i < filterLeader.length; i += 1) {
        const cacheIds = underLeader.current?.[filterLeader[i].email];
        if (cacheIds) {
          if (cacheIds && cacheIds.length) {
            allIds = [...allIds, ...cacheIds];
          }
        } else {
          if (filterLeader[i]?.email) {
            const users = [] as any;
            const encodeStr = escape(filterLeader[i].email);
            try {
              const result =
                (await (window as any).textsecure.messaging.getMemberByLeader(
                  encodeStr
                )) || {};
              const { userList } = result || {};
              if (userList && userList instanceof Array) {
                for (let j = 0; j < userList.length; j++) {
                  users.push(userList[j]);
                }
              }

              const ids = users.map((user: any) => {
                if (user.number && user.number.length) {
                  return user.number;
                }
              });

              allIds = [...allIds, ...ids];
              underLeader.current[filterLeader[i].email] = ids;
            } catch (e) {
              console.log('get user by leader catch', filterLeader[i].email, e);
            }
          }
        }
      }

      const filterAllIds = Array.from(new Set(allIds));
      const filterList =
        items.filter(item => filterAllIds.includes(item.id)) || [];
      setCurrentItems(filterList);
    } catch (e) {
      console.log('get userList by leader catch', e);
    } finally {
      setLoading(false);
    }
  };

  const renderByBU = async (filterBU: Array<any>) => {
    try {
      const { items } = props;
      let allIds = [] as any;
      for (let i = 0; i < filterBU.length; i += 1) {
        const cacheIds = underBu.current?.[filterBU[i].dn];
        if (cacheIds) {
          if (cacheIds && cacheIds.length) {
            allIds = [...allIds, ...cacheIds];
          }
        } else {
          if (filterBU[i]?.dn) {
            const users = [] as any;
            const encodeStr = escape(filterBU[i].dn);
            try {
              const result =
                (await (window as any).textsecure.messaging.getMemberByBU(
                  encodeStr
                )) || {};
              const { members } = result || {};
              if (members && members instanceof Array) {
                for (let j = 0; j < members.length; j++) {
                  users.push(members[j]);
                }
              }

              const ids = users.map((user: any) => {
                if (user.number && user.number.length) {
                  return user.number;
                }
              });

              allIds = [...allIds, ...ids];
              underBu.current[filterBU[i].dn] = ids;
            } catch (e) {
              console.log('get user by bu catch', filterBU[i].dn, e);
            }
          }
        }
      }

      const filterAllIds = Array.from(new Set(allIds));
      const filterList =
        items.filter(item => filterAllIds.includes(item.id)) || [];
      setCurrentItems(filterList);
    } catch (e) {
      console.log('get userList by bu catch', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const { items, buList, leaderList } = props;
    const conversations: any = [];

    if (preCondition.current === 'leader') {
      if (!leaderList || !leaderList.length) {
        setCurrentItems([]);
        setLoading(false);
        return;
      }

      const filterLeader =
        leaderList.filter(
          leader =>
            leader.name?.toLowerCase() === searchText.trim().toLowerCase()
        ) || [];
      if (filterLeader.length > 0) {
        setLoading(true);
        renderByLeader(filterLeader);
        return;
      } else {
        setLoading(false);
        setCurrentItems(conversations);
        return;
      }
    }

    if (preCondition.current === 'bu') {
      if (!buList || !buList.length) {
        setLoading(false);
        setCurrentItems([]);
        return;
      }

      const filterBU =
        buList.filter(
          bu => bu.name?.toLowerCase() === searchText.trim().toLowerCase()
        ) || [];
      if (filterBU.length > 0) {
        setLoading(true);
        renderByBU(filterBU);
        return;
      } else {
        setLoading(false);
        setCurrentItems(conversations);
        return;
      }
    }

    for (let i = 0; i < items.length; i += 1) {
      if (isSearchMatch(items[i], searchText)) {
        conversations.push(items[i]);
      }
    }

    setLoading(false);
    setCurrentItems(conversations);
  }, [searchText, preCondition.current]);

  useEffect(() => {
    if (!currentItems.length) {
      return;
    }
    updateIsSelectAll();
  }, [currentItems, rightItems]);

  const setInputFocus = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const inputTextChanged = (event: React.FormEvent<HTMLInputElement>) => {
    setSearchText(event.currentTarget.value || '');
  };

  const isSearchMatch = (c: any, searchTerm: string) => {
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

  const renderLeftRow = ({ index, style }: any): JSX.Element => {
    const conversation = currentItems[index];
    const checkboxStatus = disabledItems?.includes(conversation.id);
    const { memberRapidRole } = props;
    const rapidRole =
      memberRapidRole && conversation
        ? memberRapidRole?.[conversation.id]
        : undefined;
    const isOutside = (window as any).ConversationController.get(
      conversation.id
    )?.isOutside(conversation?.extId);
    return (
      <ContactListItem
        i18n={i18n}
        key={conversation.id}
        {...conversation}
        verified={false}
        style={style}
        onClick={() => {
          if (checkboxStatus) {
            return;
          }

          if (rightItems.includes(conversation.id)) {
            // tslint:disable-next-line:prefer-for-of
            for (let i = 0; i < rightItems.length; i += 1) {
              if (rightItems[i] === conversation.id) {
                rightItems.splice(i, 1);
                break;
              }
            }
            setRightItems([...rightItems]);
            setIsSelectAll(false);
          } else {
            setRightItems([...rightItems, conversation.id]);
          }
          if (inputRef.current?.value) {
            inputRef.current.value = '';
            setSearchText('');
            setTimeout(() => {
              setInputFocus();
            }, 0);
            //setInputFocus();
          }
        }}
        withCheckbox={true}
        checkboxChecked={checkboxStatus || rightItems.includes(conversation.id)}
        disableCheckbox={checkboxStatus}
        rapidRole={rapidRole}
        isOutside={isOutside}
        isCreateGroup={true}
      />
    );
  };

  const updateIsSelectAll = () => {
    const rightIds = rightItems?.filter(rightItem => rightItem) || [];
    const disableIds = disabledItems?.map(item => item) || [];
    for (let i = 0; i < currentItems.length; i++) {
      if (
        !rightIds.includes(currentItems[i].id) &&
        !currentItems[i].isMe &&
        !disableIds.includes(currentItems[i].id)
      ) {
        setIsSelectAll(false);
        return;
      }
    }
    setIsSelectAll(true);
  };

  const renderRightRow = ({ index, style }: any): JSX.Element => {
    const { items, memberRapidRole } = props;
    const id = rightItems[index];
    let conversation: any;
    for (let i = 0; i < items.length; i += 1) {
      if (id === items[i].id) {
        conversation = items[i];
        break;
      }
    }
    if (!conversation) {
      throw Error('Bad right items.');
    }
    const rapidRole =
      memberRapidRole && conversation
        ? memberRapidRole?.[conversation.id]
        : undefined;
    const isOutside = (window as any).ConversationController.get(
      conversation.id
    )?.isOutside(conversation?.extId);
    return (
      <ContactListItem
        i18n={i18n}
        key={conversation.id}
        {...conversation}
        verified={false}
        style={style}
        onClick={() => {
          for (let i = 0; i < rightItems.length; i += 1) {
            if (rightItems[i] === conversation.id) {
              rightItems.splice(i, 1);
              break;
            }
          }
          setRightItems([...rightItems]);
        }}
        rapidRole={rapidRole}
        isOutside={isOutside}
        isCreateGroup={true}
      />
    );
  };

  const renderLeftList = () => {
    const showSelectAll =
      (preCondition.current === 'bu' || preCondition.current === 'leader') &&
      currentItems.length;
    return (
      <div
        className={classNames(
          'module-left-pane__list',
          'scroll-background-create-group'
        )}
        key={0}
        style={{ height: showSelectAll ? '336px' : '366px' }}
        onScroll={() => {
          preShowCondition.current = false;
          setShowConditionList(false);
        }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className={'module-left-pane__virtual-list overflow-style-normal'}
              conversations={currentItems}
              height={height}
              rowCount={currentItems.length}
              rowHeight={56}
              rowRenderer={renderLeftRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  };

  const renderRightList = () => {
    return (
      <div
        className={classNames(
          'module-left-pane__list',
          'scroll-background-create-group'
        )}
        key={1}
        style={{ height: '386px' }}
        onScroll={() => {
          preShowCondition.current = false;
          setShowConditionList(false);
        }}
      >
        <AutoSizer>
          {({ height, width }) => (
            <List
              className={'module-left-pane__virtual-list overflow-style-normal'}
              conversations={rightItems}
              height={height}
              rowCount={rightItems.length}
              rowHeight={56}
              rowRenderer={renderRightRow}
              width={width}
            />
          )}
        </AutoSizer>
      </div>
    );
  };

  const renderInput = () => {
    if (!defaultName) {
      return null;
    }

    return (
      <div className={'create-group-name-container'}>
        <p className={'label'}>{i18n('name')}</p>
        <input
          className={'name-input'}
          defaultValue={defaultName}
          maxLength={maxGroupNameLength}
          onChange={event => {
            let text = event.target.value?.trim();
            if (text && text.length > maxGroupNameLength) {
              text = text.substr(0, maxGroupNameLength);
            }
            setGroupName(text);
          }}
        />
      </div>
    );
  };

  const handleDragMainContainer = (event: any) => {
    event.preventDefault();
    event.stopPropagation();
    return false;
  };

  const showCurrentConditionList = () => {
    const condition = preCondition.current;
    if (condition === 'leader') {
      setShowLeaderList(true);
      return;
    }
    if (condition === 'bu') {
      setShowBUList(true);
      return;
    }
  };

  const renderMainContainer = () => {
    return (
      <div
        className={classNames('select-container')}
        onDragStart={handleDragMainContainer}
      >
        <div
          className={classNames('list-container')}
          style={{ marginRight: '16px', marginLeft: '5px' }}
        >
          <div className="search-container">
            {/* <div className="condition-box" ref={conditionSwitchRef}>
              <div className="condition">
                {i18n('create-group-' + preCondition.current)}
              </div>
              <div className="sort-icon" />
            </div> */}
            <div
              role="button"
              className="search-icon"
              onClick={setInputFocus}
            />
            <input
              type="text"
              ref={inputRef}
              className="search-input"
              placeholder={i18n('search')}
              dir="auto"
              onChange={inputTextChanged}
              onInput={showCurrentConditionList}
            />
            {searchText && (
              <div
                id={'clear-search-icon'}
                role="button"
                className="clear-search-icon"
                onClick={() => {
                  setSearchText('');
                  setInputFocus();
                  if (inputRef.current) {
                    inputRef.current.value = '';
                  }
                }}
              />
            )}
          </div>
          {showConditionList && renderConditionList()}
          {showBUList && renderBUList()}
          {showLeaderList && renderLeaderList()}
          {!loading && renderSelectAll()}
          {!loading &&
            currentItems &&
            (currentItems.length ? renderLeftList() : renderNoResult())}
          {loading && renderLoading()}
        </div>
        <div className={classNames('list-container')}>
          <div className={'selected-members'}>{i18n('selected-members')}</div>
          {renderRightList()}
        </div>
      </div>
    );
  };

  const renderLoading = () => {
    return (
      <div className={'loading-box'}>
        <div className={'loading-item'}>
          <Spin />
          <p className={'loading-label'}>Loading...</p>
        </div>
      </div>
    );
  };

  const renderFullLoading = () => {
    if (!props.loading) {
      return null;
    }

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          textAlign: 'center',
          zIndex: 200,
        }}
      >
        <div style={{ width: '100%', height: '100%' }}>
          <div className={'waiting-border'}>
            <div
              className="waiting"
              style={{ width: 40, height: 40, margin: 10 }}
            />
          </div>
        </div>
      </div>
    );
  };

  const renderNoResult = () => {
    const { i18n } = props;
    if (preCondition.current === 'bu' || preCondition.current === 'leader') {
      return (
        <div className={'noresult-box'}>
          {inputRef?.current?.value && (
            <div className={'item-box'}>
              <div className={'tip-no-result'}>{i18n('no-results-found')}</div>
            </div>
          )}
          <div className={'item-box'}>
            <div className={'number'}>1.</div>
            <div className={'tip'}>
              {i18n(`${preCondition.current}-noresult-tip1`)}
            </div>
          </div>
          <div className={'item-box'}>
            <div className={'number'}>2.</div>
            <div className={'tip'}>
              {i18n(`${preCondition.current}-noresult-tip2`)}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className={'common-noresult'}>
        {i18n('noSearchResults', [searchText])}
      </div>
    );
  };

  const renderSelectAll = () => {
    if (
      (preCondition.current === 'bu' || preCondition.current === 'leader') &&
      currentItems.length
    ) {
      return (
        <div className={'select-all'} onClick={handleSelectAll}>
          <input
            type="checkbox"
            className={'check-all'}
            readOnly
            checked={isSelectAll}
          />
          <p className={'check-all-label'}>{i18n('select-all')}</p>
        </div>
      );
    }
    return null;
  };

  const handleSelectAll = () => {
    if (isSelectAll) {
      const disableIds = disabledItems?.map(item => item) || [];
      const filterItems =
        currentItems.filter(
          item => !item.isMe && !disableIds.includes(item.id)
        ) || [];
      const filterLeftIds = filterItems.map(item => item.id) || [];

      const rightIds = [...rightItems]?.filter(rightItem => rightItem) || [];
      const result = [];
      for (let i = 0; i < rightIds.length; i++) {
        if (!filterLeftIds.includes(rightIds[i])) {
          result.push(rightIds[i]);
        }
      }
      setRightItems(result);
    } else {
      const disableIds = disabledItems?.map(item => item) || [];
      const filterItems =
        currentItems.filter(
          item => !item.isMe && !disableIds.includes(item.id)
        ) || [];
      const filterLeftIds = filterItems.map(item => item.id) || [];

      const right = [...rightItems];
      const rightIds = right?.filter(rightItem => rightItem) || [];

      if (!rightIds.length) {
        setRightItems(filterLeftIds);
        return;
      }

      for (let i = 0; i < filterLeftIds.length; i++) {
        if (!rightIds.includes(filterLeftIds[i])) {
          right.push(filterLeftIds[i]);
        }
      }

      setRightItems(right);
    }
  };

  const switchCondition = (condition: string) => {
    preShowCondition.current = false;
    setShowConditionList(false);

    if (condition !== preCondition?.current) {
      preCondition.current = condition;
      setInputFocus();
      if (condition === 'leader') {
        setShowLeaderList(true);
        setCurrentItems([]);
      }
      if (condition === 'bu') {
        setShowBUList(true);
        setCurrentItems([]);
      }
      if (condition === 'contact') {
        setShowLeaderList(false);
        setShowBUList(false);
        setCurrentItems(props.items);
      }
    } else {
      setInputFocus();
      if (condition === 'leader') {
        setShowLeaderList(true);
      }
      if (condition === 'bu') {
        setShowBUList(true);
      }
      if (condition === 'contact') {
        setShowLeaderList(false);
        setShowBUList(false);
      }
    }
  };

  const renderConditionList = () => {
    return (
      <div className={'condition-list'}>
        <div
          className={'condition-list-item'}
          onClick={() => {
            switchCondition('contact');
          }}
        >
          {i18n('create-group-contact')}
        </div>
        <div
          id={'leader-condition'}
          className={'condition-list-item'}
          onClick={() => {
            switchCondition('leader');
          }}
        >
          {i18n('create-group-leader')}
        </div>
        <div
          id={'bu-condition'}
          className={'condition-list-item'}
          onClick={() => {
            switchCondition('bu');
          }}
        >
          {i18n('create-group-bu')}
        </div>
      </div>
    );
  };

  useEffect(() => {
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
    };
  }, []);
  const handleClick = (event: MouseEvent) => {
    if (event) {
      if (
        conditionSwitchRef.current &&
        conditionSwitchRef.current.contains(event.target as Node)
      ) {
        setShowBUList(false);
        setShowLeaderList(false);

        preShowCondition.current = !preShowCondition.current;
        setShowConditionList(preShowCondition.current);
        return;
      }

      if (inputRef.current && inputRef.current.contains(event.target as Node)) {
        preShowCondition.current = false;
        setShowConditionList(false);

        if (preCondition?.current === 'contact') {
          setShowBUList(false);
          setShowLeaderList(false);
        } else if (preCondition?.current === 'leader') {
          setShowBUList(false);
          setShowLeaderList(true);
        } else if (preCondition?.current === 'bu') {
          setShowBUList(true);
          setShowLeaderList(false);
        } else {
          setShowBUList(false);
          setShowLeaderList(false);
        }

        return;
      }

      if ((event.target as HTMLDivElement).id === 'clear-search-icon') {
        if (preCondition.current === 'bu') {
          setShowBUList(true);
        }
        if (preCondition.current === 'leader') {
          setShowLeaderList(true);
        }
        return;
      }

      if (
        (event.target as HTMLDivElement).id === 'leader-condition' ||
        (event.target as HTMLDivElement).id === 'bu-condition'
      ) {
        return;
      }

      preShowCondition.current = false;
      setShowConditionList(false);
      setShowBUList(false);
      setShowLeaderList(false);
    }
  };

  const filterConditionList = (buList: any) => {
    if (!searchText || !searchText.trim().length) {
      return buList;
    }
    return (
      buList.filter((item: any) =>
        item.name.toLowerCase().startsWith(searchText.trim().toLowerCase())
      ) || []
    );
  };

  const renderBUList = () => {
    const { buList } = props;
    if (!buList || buList.length === 0) {
      return null;
    }

    const filterList = filterConditionList(buList);
    if (!filterList.length) {
      return null;
    }
    return (
      <div
        className={classNames(
          'bu-scroll-box',
          'scroll-background-create-group'
        )}
      >
        <div className={'bu-list'}>
          {filterList.map((b: any) => {
            return (
              <div
                key={b.id}
                className={'bu-list-item'}
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.value = b.name;
                  }
                  setSearchText(b.name);
                  setInputFocus();
                }}
              >
                {b.name}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderAvatar = (conversation: ConversationListItemPropsType) => {
    const { i18n } = props;
    return (
      <Avatar
        conversationType={'direct'}
        i18n={i18n}
        size={20}
        {...conversation}
      />
    );
  };

  const renderLeaderList = () => {
    const { leaderList } = props;
    if (!leaderList || leaderList.length === 0) {
      return null;
    }

    const filterList = filterConditionList(leaderList);
    if (!filterList.length) {
      return null;
    }

    return (
      <div
        className={classNames(
          'leader-scroll-box',
          'scroll-background-create-group'
        )}
      >
        <div className={'leader-list'}>
          {filterList.map((u: any) => {
            const user = (window as any).ConversationController.get(u?.number);
            if (!user) {
              return null;
            }
            const cacheProps = user?.getProps() || {};
            return (
              <div
                key={u.email}
                className={'leader-list-item'}
                onClick={() => {
                  if (inputRef.current) {
                    inputRef.current.value = u.name;
                  }
                  setInputFocus();
                  setSearchText(u.name);
                }}
              >
                <div className={'avatar'}>{renderAvatar(cacheProps)}</div>
                <div className={'name'}>{u.name}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderImportButton = () => {
    if (props.type !== 'new-group' && props.type !== 'add-group-members') {
      return null;
    }
    return (
      <>
        <button
          className={'btn-white'}
          onClick={() => {
            if (importInputRef.current) {
              importInputRef.current.click();
            }
          }}
        >
          {i18n('group_editor_import')}
        </button>
        <input
          ref={importInputRef}
          type="file"
          style={{ display: 'none' }}
          accept=".csv"
          onChange={async () => {
            if (!importInputRef.current) {
              return;
            }

            const imported: any = [];
            const files = importInputRef.current.files;
            if (!files) {
              return;
            }
            for (let index = 0; index < files.length; index += 1) {
              const file = files[index];
              const parser = (window as any).fs
                .createReadStream(file.path)
                .pipe(
                  (window as any).csv_parse({
                    bom: true,
                    delimiter: [',', ';'],
                    trim: true,
                    relax_column_count: true,
                    skip_empty_lines: true,
                    skip_records_with_empty_values: true,
                  })
                );

              for await (const record of parser) {
                record.forEach((email: string) => {
                  if (!email) {
                    return;
                  }
                  for (let i = 0; i < props.items.length; i++) {
                    const item = props.items[i];
                    if (item.email) {
                      if (
                        email.toLowerCase() === item.email.toLowerCase() &&
                        !rightItems.includes(item.id)
                      ) {
                        if (!disabledItems?.includes(item.id)) {
                          imported.push(item.id);
                        }
                      }
                    }
                  }
                });
              }
            }

            if (imported.length) {
              setRightItems([...rightItems, ...imported]);
            }
            setTimeout(
              () => alert(i18n('importUsers', [imported.length + ''])),
              50
            );
            importInputRef.current.value = '';
          }}
        />
      </>
    );
  };

  let okButtonDisabled = rightItems.length === 0;
  let title;
  if (props.type === 'new-group' || props.type === 'rapid-group') {
    title = i18n('group_editor_create_new_group');
  }
  if (props.type === 'group-rapid-group') {
    title = i18n('group_editor_dialog_title_for_rapid_group');
    okButtonDisabled = false;
  }
  return (
    <Dialog onClose={onClose} escClose={!props.loading}>
      <div className="settings-members-change-dialog-create-group">
        <div className={'header'}>
          <h3 className={'title'}>{title}</h3>
          <div onClick={onClose} className={'close'} />
        </div>
        {renderInput()}
        {renderMainContainer()}
        <div style={{ textAlign: 'right' }}>
          {renderImportButton()}
          <button className={'btn-white'} onClick={onClose}>
            {i18n('cancel')}
          </button>
          <button
            disabled={okButtonDisabled}
            className={classNames(
              'btn-blue',
              !okButtonDisabled ? 'btn-blue-able' : 'btn-blue-disable'
            )}
            onClick={() => {
              props.onConfirm(rightItems, { groupName });
            }}
          >
            {i18n('confirmNumber', ['' + (rightItems.length || '')])}
          </button>
        </div>
        {renderFullLoading()}
      </div>
    </Dialog>
  );
}
