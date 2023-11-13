import React from 'react';
import { LocalizerType } from '../../types/Util';

interface Props {
  i18n: LocalizerType;
  rapidRoleName: any;
  operatorName: any;
  updateMemberName: any;
}
export class GroupMemberRapidRoleNotification extends React.Component<Props> {
  public render() {
    const { rapidRoleName, operatorName, updateMemberName, i18n } = this.props;
    if (!rapidRoleName || !operatorName || !updateMemberName) return null;

    if (rapidRoleName === 'none') {
      return (
        <div className="module-remind-cycle-notification">
          {i18n('groupMemberRapidRoleRemove', [operatorName, updateMemberName])}
        </div>
      );
    }
    return (
      <div className="module-remind-cycle-notification">
        {i18n('groupMemberRapidRoleUpdate', [
          operatorName,
          updateMemberName,
          rapidRoleName,
        ])}
      </div>
    );
  }
}
