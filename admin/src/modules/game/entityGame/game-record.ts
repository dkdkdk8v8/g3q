import { Entity, Column, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 游戏记录表
 */
@Entity('g3q_game_record')
export class GameRecordEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ comment: '游戏名称' })
  game_name: string;

  @Index()
  @Column({ comment: '游戏记录ID' })
  game_id: string;

  @Column({ comment: '房间ID', nullable: true, default: null })
  room_id: string;

  @Column({ comment: '游戏数据' })
  game_data: string;

  @Column({ comment: '创建时间' })
  create_at: Date;

}
