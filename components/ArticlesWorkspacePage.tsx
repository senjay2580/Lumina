import { useState } from 'react';
import ArticlesPage from './creations/ArticlesPage';
import ArticleDetailPage from './creations/ArticleDetailPage';
import ArticleEditorPage from './creations/ArticleEditorPage';
import type { Article } from '../lib/articles';

interface Props {
  userId: string;
}

type ArticleWorkspaceMode = 'list' | 'detail' | 'editor';

export default function ArticlesWorkspacePage({ userId }: Props) {
  const [mode, setMode] = useState<ArticleWorkspaceMode>('list');
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  const handleOpenArticle = (article: Article) => {
    setSelectedArticle(article);
    setMode('detail');
  };

  const handleCreateArticle = () => {
    setSelectedArticle(null);
    setMode('editor');
  };

  const handleEditArticle = (article: Article) => {
    setSelectedArticle(article);
    setMode('editor');
  };

  const handleArticleSaved = (article: Article) => {
    setSelectedArticle(article);
    setMode('detail');
  };

  if (mode === 'editor') {
    return (
      <ArticleEditorPage
        userId={userId}
        initial={selectedArticle}
        onBack={() => setMode(selectedArticle?.id ? 'detail' : 'list')}
        onSaved={handleArticleSaved}
      />
    );
  }

  if (mode === 'detail' && selectedArticle) {
    return (
      <ArticleDetailPage
        articleId={selectedArticle.id}
        initial={selectedArticle}
        onBack={() => {
          setSelectedArticle(null);
          setMode('list');
        }}
        onEdit={handleEditArticle}
        onImported={handleArticleSaved}
      />
    );
  }

  return (
    <ArticlesPage
      userId={userId}
      onOpenArticle={handleOpenArticle}
      onCreateArticle={handleCreateArticle}
      onEditArticle={handleEditArticle}
    />
  );
}
