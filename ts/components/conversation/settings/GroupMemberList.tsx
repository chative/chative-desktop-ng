import React, { useEffect, useState, useRef } from 'react';
import { ContactListItem } from '../../ContactListItem';
import { AutoSizer, List } from 'react-virtualized';
import { LocalizerType } from '../../../types/Util';
import { trigger } from '../../../shims/events';
// import { GroupRapidTag } from '../../GroupRapidTga';
import { isLinux } from '../../../OS';
import { ConversationListItem } from '../../ConversationListItem';

type PropsType = {
  i18n: LocalizerType;
  members: Array<any>;
  transferGroupOwner?: (id: string) => void;
  changeGroupMemberRapidRole?: (role: number, memberId: string) => void;
  memberRapidRole?: any;
  isCommonGroups?: boolean;
};

export default function GroupMemberList(props: PropsType) {
  //const { i18n, members, transferGroupOwner, changeGroupMemberRapidRole } =
  const { i18n, members, transferGroupOwner, isCommonGroups } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<List>(null);
  const [searchText, setSearchText] = useState('');
  const [filterMembers, setFilterMembers] = useState<Array<any>>(members);
  const [oldSecondLabelIndex, setOldSecondLabelIndex] = useState(-1);
  //const [currentEditMember, setCurrentEditMember] = useState<any>(undefined);

  // 1-Recommend， 2-Agree， 3-Perform， 4-Input， 5-Decider， 6-Observer， 0-none
  //const rapidRoles = [1, 2, 3, 4, 5, 6];

  const dealMembers = (members: any) => {
    if (isCommonGroups) {
      setFilterMembers(members);
      return;
    }

    let result = [];
    let hasManagers = false;
    let hasUsers = false;
    for (let i = 0; i < members.length; i += 1) {
      if (members[i].role === 0 || members[i].role === 1) {
        if (!hasManagers) {
          hasManagers = true;
          result.push({
            isLabel: true,
            name: i18n('conversation_settings_admin'),
          });
        }
      } else {
        if (!hasUsers) {
          hasUsers = true;
          result.push({
            isLabel: true,
            shouldRecomputeHeight: true,
            name: i18n('conversation_settings_user'),
          });
        }
      }
      result.push(members[i]);
    }
    setFilterMembers(result);
  };

  useEffect(() => {
    if (!searchText) {
      dealMembers(members);
    } else {
      const f = [];
      for (let i = 0; i < members.length; i += 1) {
        if (isSearchMatch(members[i], searchText)) {
          f.push(members[i]);
        }
      }
      dealMembers(f);
    }
  }, [members, searchText]);

  useEffect(() => {
    if (
      oldSecondLabelIndex >= 0 &&
      oldSecondLabelIndex < filterMembers.length
    ) {
      listRef.current?.recomputeRowHeights(oldSecondLabelIndex);
    }
    for (let i = 0; i < filterMembers.length; i += 1) {
      if (filterMembers[i].shouldRecomputeHeight) {
        listRef.current?.recomputeRowHeights(i);
        setOldSecondLabelIndex(i);
        break;
      }
    }
  }, [filterMembers]);

  const handleClick = () => {
    restoreMenuStyle();
  };
  useEffect(() => {
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('click', handleClick);
    };
  });
  const restoreMenuStyle = () => {
    $('.group-members-operation-first-menu').css('display', 'none');
    $('.group-members-operation-second-menu').css('display', 'none');
    $('.module-left-pane__virtual-list-rapid').css('overflow', 'auto');
  };

  const renderRow = ({ index, style }: any): JSX.Element => {
    const c = filterMembers[index];
    if (c.isLabel) {
      return (
        <div key={index} style={style} className={'label-container'}>
          {c.name}
        </div>
      );
    }
    const rapidRole =
      props?.memberRapidRole && c ? props?.memberRapidRole?.[c.id] : undefined;
    const isOutside = (window as any).ConversationController.get(
      c.id
    )?.isOutside(c.extId);

    if (isCommonGroups) {
      return (
        <ConversationListItem
          key={c.id}
          {...c}
          isStick={undefined}
          onClick={() => {
            trigger('showConversation', c.id);
            const myEvent = new Event('event-toggle-switch-chat');
            window.dispatchEvent(myEvent);
          }}
          style={{
            ...style,
            maxWidth: '100%',
            paddingLeft: '8px',
            paddingRight: '8px',
          }}
          i18n={i18n}
          isMyGroup={true}
          showMembersPreview={true}
        />
      );
    }

    return (
      <ContactListItem
        key={index}
        id={c.id}
        style={style}
        phoneNumber={c.id}
        isMe={c.isMe}
        name={c.name}
        color={(c as any).color}
        verified={false}
        profileName={(c as any).profileName}
        avatarPath={(c as any).avatarPath}
        email={(c as any).email}
        i18n={props.i18n}
        onClick={async (event: any) => {
          if (event && event.button === 2) {
            // setCurrentEditMember(c);
            showFirstLevelMenu(event);
            $('.module-left-pane__virtual-list-rapid').css(
              'overflow',
              'hidden'
            );
            return;
          }
          if (transferGroupOwner) {
            if ((window as any).Signal.ID.isBotId(c.id)) {
              alert(i18n('conversation_settings_group_transfer_bot'));
              return;
            }
            const confirmText = i18n('transferOwnerOfTheGroup', [
              c.name || c.id,
            ]);

            if (isLinux()) {
              if (await (window as any).whisperConfirm(confirmText)) {
                transferGroupOwner(c.id);
              }
            } else {
              if (confirm(confirmText)) {
                transferGroupOwner(c.id);
              }
            }

            return;
          }
          trigger('showConversation', c.id);
          const myEvent = new Event('event-toggle-switch-chat');
          window.dispatchEvent(myEvent);
        }}
        rapidRole={rapidRole}
        isOutside={isOutside}
      />
    );
  };

  const handleChange = (event: any) => {
    const { value: search } = event.target;
    setSearchText(search);
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

  const clearSearch = () => {
    setSearchText('');
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const rowHeight = ({ index }: any) => {
    if (filterMembers[index].isLabel) {
      return 20;
    }
    return 58;
  };

  const showFirstLevelMenu = (event: MouseEvent) => {
    let x = event.pageX;
    let y = event.pageY;
    const windowHeight = window.innerHeight;
    const windowWidth = window.innerWidth;
    const menuWidth =
      $('.group-members-operation-first-menu').innerWidth() || 0;
    const menuHeight =
      $('.group-members-operation-first-menu').innerHeight() || 0;
    const boxWidth = $('.member-list-container').innerWidth() || 0;
    if (x + menuWidth > windowWidth) {
      x = boxWidth - (windowWidth - x) - menuWidth;
    } else {
      x = boxWidth - (windowWidth - x);
    }

    if (y + menuHeight + 10 > windowHeight) {
      y = y - menuHeight - 116;
    } else {
      y = y - 116;
    }
    $('.group-members-operation-first-menu')
      .css('left', x)
      .css('top', y)
      .css('display', 'block');
  };
  // const handleEditRoleMenuMouseLeave = () => {
  //   restoreRoleMenuListSite();
  // };
  // const handleEditRoleMenuMouseover = () => {
  //   adaptEditRoleMenuListSite();
  // };
  // const handleRoleListItemMouseover = () => {
  //   adaptEditRoleMenuListSite();
  // };
  // const handleRoleListItemMouseleave = () => {
  //   restoreRoleMenuListSite();
  // };
  // const adaptEditRoleMenuListSite = () => {
  //   $('.group-members-operation-second-menu').css('display', 'block');
  //   const roleList = document.querySelector(
  //     '.group-members-operation-second-menu'
  //   ) as any;
  //   const firstMenu = document.querySelector(
  //     '.group-members-operation-first-menu'
  //   ) as any;
  //   const windowHeight = window.innerHeight;
  //   const roleListOffsetTop = roleList.getBoundingClientRect().top;
  //   const roleListOffsetHeight = roleList.offsetHeight;
  //   const roleListOffsetWidth = roleList.offsetWidth;

  //   const firstMenuOffsetWidth = firstMenu.offsetWidth;
  //   const firstMenuOffsetLeft = firstMenu.offsetLeft;

  //   if (
  //     firstMenuOffsetLeft + firstMenuOffsetWidth + roleListOffsetWidth >
  //     355
  //   ) {
  //     $('.group-members-operation-second-menu').css('left', -180);
  //   } else {
  //     $('.group-members-operation-second-menu').css('left', 106);
  //   }

  //   if (roleListOffsetTop + roleListOffsetHeight > windowHeight) {
  //     $('.group-members-operation-second-menu').css('top', -202);
  //   }
  // };

  // const restoreRoleMenuListSite = () => {
  //   $('.group-members-operation-second-menu')
  //     .css('display', 'none')
  //     .css('top', -8);
  // };

  // const renderFirstLevelMenus = () => {
  //   return (
  //     <div className={'group-members-operation-first-menu'}>
  //       <div
  //         className={'item'}
  //         onMouseOver={handleEditRoleMenuMouseover}
  //         onMouseLeave={handleEditRoleMenuMouseLeave}
  //       >
  //         <div className={'common-operation'}>{i18n('group_edit_role')}</div>
  //         <div className={'show-second-level-icon'} />
  //         {renderSecondLevelMenus()}
  //       </div>
  //     </div>
  //   );
  // };
  // const renderSecondLevelMenus = () => {
  //   const { memberRapidRole } = props;
  //   const rapidRole =
  //     memberRapidRole && currentEditMember
  //       ? memberRapidRole?.[currentEditMember.id]
  //       : undefined;

  //   // const rapidRole = currentEditMember ? currentEditMember.rapidRole : undefined;
  //   return (
  //     <div className={'group-members-operation-second-menu'}>
  //       {rapidRoles.map((r: number) => {
  //         return (
  //           <div
  //             className={'rapid-item'}
  //             key={r + 'rapid'}
  //             onMouseOver={handleRoleListItemMouseover}
  //             onMouseLeave={handleRoleListItemMouseleave}
  //             onMouseDown={() => {
  //               if (rapidRole === r) {
  //                 console.log('check the same rapid role, skip......');
  //                 return;
  //               }
  //               handleChangeGroupMemberRapidRole(r);
  //             }}
  //           >
  //             <div style={{ display: 'inherit', paddingTop: '7px' }}>
  //               <GroupRapidTag i18n={props.i18n} rapidRole={r} />
  //             </div>
  //             <div className={'rapid-text'}>{i18n(`rapid_${r}`)}</div>
  //             {rapidRole === r && <div className={'rapid-check-icon'} />}
  //           </div>
  //         );
  //       })}
  //       <div
  //         className={'rapid-item rapid-item-none'}
  //         onMouseDown={() => {
  //           handleChangeGroupMemberRapidRole(0);
  //         }}
  //       >
  //         <div className={'rapid-text '}>None</div>
  //         {(!rapidRole || !rapidRoles.includes(rapidRole)) && (
  //           <div className={'rapid-check-icon'} />
  //         )}
  //       </div>
  //     </div>
  //   );
  // };

  // const handleChangeGroupMemberRapidRole = (r: number) => {
  //   console.log(currentEditMember, 'check rapid role', r);
  //   changeGroupMemberRapidRole?.(r, currentEditMember?.id);
  // };

  return (
    <div
      className={'select-contact-smaller-dialog'}
      style={{
        width: '100%',
        height: 'calc(100% - 58px)',
        fontSize: '13px',
        userSelect: 'none',
      }}
    >
      <div style={{ width: '100%', height: '100%', float: 'left' }}>
        <div className="module-main-header" style={{ width: '100%' }}>
          <div className="module-main-header__search" style={{ width: '100%' }}>
            <div role="button" className="module-main-header__search__icon" />
            <input
              style={{ width: '100%' }}
              type="text"
              ref={inputRef}
              className={
                'module-main-header__search__input select-contact-smaller-input input-background'
              }
              placeholder={props.i18n('search')}
              dir="auto"
              value={searchText}
              onChange={handleChange}
              // onBlur={this.blurSearchInput}
            />
            {searchText ? (
              <div
                role="button"
                className="module-main-header__search__cancel-icon"
                onClick={clearSearch}
              />
            ) : null}
          </div>
        </div>
        {filterMembers.length ? (
          <div className={'member-list-container'}>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  ref={listRef}
                  className="module-left-pane__virtual-list-rapid"
                  height={height}
                  rowCount={filterMembers.length}
                  rowRenderer={renderRow}
                  rowHeight={rowHeight}
                  width={width}
                  rerenderWhenChanged={filterMembers}
                />
              )}
            </AutoSizer>
            {/* {renderFirstLevelMenus()} */}
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginTop: '5px' }}>
            {i18n('noSearchResults', [searchText])}
          </div>
        )}
      </div>
    </div>
  );
}
