// BROKEN

//import React from 'react'
//import Icon from './Icon'
//import type { IconProps, IconVariant } from './Icon'
//
//export const createIconComponent = (
//  name: string,
//  defaultVariant: IconVariant = 'outline'
//): React.FC<Omit<IconProps, 'name'>> => {
//  const IconComponent: React.FC<Omit<IconProps, 'name'>> = (props) => {
//    return (
//      <Icon
//        name={name}
//        variant={(props as any).variant ?? defaultVariant}
//        {...props}
//      />
//    )
//  }
//
//  IconComponent.displayName = `${name}Icon`
//  return IconComponent
//}
//