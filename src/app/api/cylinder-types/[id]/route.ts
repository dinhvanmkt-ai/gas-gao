// Bình đầy theo loại = Product(type=gas).stock — dùng /api/products/[id] để điều chỉnh
import { NextResponse } from 'next/server'
export async function GET() { return NextResponse.json({ error: 'Dùng /api/products/[id] để điều chỉnh tồn kho' }, { status: 410 }) }
export async function PUT() { return NextResponse.json({ error: 'Dùng /api/products/[id] để điều chỉnh tồn kho' }, { status: 410 }) }
export async function DELETE() { return NextResponse.json({ error: 'Dùng /api/products/[id] để xóa sản phẩm gas' }, { status: 410 }) }
