'use client';
import { use } from 'react';
import { BoardScreen } from '@/components/board-screen';
export default function BoardPage({ params }: { params: Promise<{ boardId: string }> }) { const { boardId } = use(params); return <BoardScreen key={boardId} boardId={boardId} />; }
