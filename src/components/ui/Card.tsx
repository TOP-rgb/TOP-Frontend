import * as React from "react"

import { cn } from "@/lib/utils"

function Card({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "bg-white dark:bg-slate-900 text-slate-900 dark:text-white flex flex-col gap-6 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 py-6 shadow-sm hover:shadow-md transition-shadow duration-200",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        "@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-6",
        className
      )}
      {...props}
    />
  )
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-title"
      className={cn("leading-none font-semibold", className)}
      {...props}
    />
  )
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      {...props}
    />
  )
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-content"
      className={cn("px-6", className)}
      {...props}
    />
  )
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn("flex items-center px-6 [.border-t]:pt-6", className)}
      {...props}
    />
  )
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ReactNode
  color?: 'blue' | 'emerald' | 'amber' | 'purple' | 'red' | 'indigo' | 'pink'
  trend?: 
    | {
        value: number
        label: string
        direction?: 'up' | 'down'
      }
    | string  // Allow string format like "+12%"
  className?: string
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'blue',
  trend,
  className
}: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
    pink: 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400',
  }[color]

  // Handle trend display
  const renderTrend = () => {
    if (!trend) return null
    
    // If trend is a string, display it directly
    if (typeof trend === 'string') {
      const isPositive = trend.startsWith('+')
      return (
        <div className="flex items-center gap-1">
          <span className={cn(
            "text-xs font-medium",
            isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
          )}>
            {trend}
          </span>
        </div>
      )
    }
    
    // If trend is an object, use its properties
    const trendColor = trend.value > 0 
      ? 'text-emerald-600 dark:text-emerald-400' 
      : 'text-red-600 dark:text-red-400'
    
    return (
      <div className="flex items-center gap-1">
        <span className={cn("text-xs font-medium", trendColor)}>
          {trend.value > 0 ? '+' : ''}{trend.value}%
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {trend.label}
        </span>
      </div>
    )
  }

  return (
    <div
      data-slot="stat-card"
      className={cn(
        "bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 p-5 shadow-sm hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200",
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        {icon && (
          <div className={cn("p-2.5 rounded-xl", colorClasses)}>
            {icon}
          </div>
        )}
        {renderTrend()}
      </div>

      <div>
        <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">
          {value}
        </p>
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {title}
        </p>
        {subtitle && (
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}

// Compact StatCard variant for smaller spaces
function CompactStatCard({ 
  title, 
  value, 
  icon, 
  color = 'blue',
  className 
}: Omit<StatCardProps, 'subtitle' | 'trend'>) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400',
    pink: 'bg-pink-50 text-pink-600 dark:bg-pink-950 dark:text-pink-400',
  }[color]

  return (
    <div
      data-slot="compact-stat-card"
      className={cn(
        "bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-3 flex items-center gap-3",
        className
      )}
    >
      {icon && (
        <div className={cn("p-1.5 rounded-md", colorClasses)}>
          {icon}
        </div>
      )}
      <div>
        <p className="text-lg font-bold text-slate-800 dark:text-slate-200 leading-none mb-1">
          {value}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {title}
        </p>
      </div>
    </div>
  )
}

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  StatCard,
  CompactStatCard
}