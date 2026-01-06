import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

/**
 * 游戏记录表
 */
@Entity('g3q_game_record')
export class GameRecordEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ comment: '游戏记录ID' })
  game_id: string;

  @Column({ comment: '游戏数据' })
  game_data: string;

  @Column({ comment: '创建时间' })
  create_at: Date;

  @Column({ comment: '更新时间' })
  update_at: Date;
}
