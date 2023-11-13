import { connect } from 'react-redux';
import { mapDispatchToProps } from '../actions';
import { TaskPane } from '../../components/task-list/TaskPane';
import { StateType } from '../reducer';
import { getIntl, getUserNumber } from '../selectors/user';

const mapStateToProps = (state: StateType) => {
  return {
    i18n: getIntl(state),
    ourNumber: getUserNumber(state),
  };
};

export const SmartTaskPane = connect(
  mapStateToProps,
  mapDispatchToProps
)(TaskPane);
