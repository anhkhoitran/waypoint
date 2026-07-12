import { Button } from '@waypoint/ui';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from './Icon';

function ErrorFallback({ onReload }: { onReload: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="error-boundary-fallback">
      <span className="empty-icon">
        <Icon name="alert" size={24} />
      </span>
      <h1 className="empty-title">{t('errorBoundary.title')}</h1>
      <p className="empty-blurb">{t('errorBoundary.blurb')}</p>
      <Button onClick={onReload}>{t('errorBoundary.reload')}</Button>
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Uncaught error in app tree:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onReload={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
